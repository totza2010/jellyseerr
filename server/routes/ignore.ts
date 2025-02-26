import { MediaStatus } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Episode from '@server/entity/Episode';
import { Ignore } from '@server/entity/Ignore';
import Media from '@server/entity/Media';
import Season from '@server/entity/Season';
import type { IgnoreResultsResponse } from '@server/interfaces/api/ignoreInterfaces';
import { Permission } from '@server/lib/permissions';
import logger from '@server/logger';
import { isAuthenticated } from '@server/middleware/auth';
import { Router } from 'express';
import { EntityNotFoundError, QueryFailedError } from 'typeorm';
import { z } from 'zod';

const ignoreRoutes = Router();

export const ignoreAdd = z.object({
  tmdbId: z.coerce.number(),
  title: z.coerce.string().optional(),
  seasonNumber: z.coerce.number(),
  seasonTitle: z.coerce.string().optional(),
  episodeNumber: z.coerce.number(),
  episodeTitle: z.coerce.string().optional(),
  user: z.coerce.number(),
});

ignoreRoutes.get(
  '/',
  isAuthenticated([Permission.MANAGE_BLACKLIST, Permission.VIEW_BLACKLIST], {
    type: 'or',
  }),
  async (req, res, next) => {
    const pageSize = req.query.take ? Number(req.query.take) : 25;
    const skip = req.query.skip ? Number(req.query.skip) : 0;
    const search = (req.query.search as string) ?? '';

    try {
      let query = getRepository(Ignore)
        .createQueryBuilder('ignore')
        .leftJoinAndSelect('ignore.user', 'user');

      if (search.length > 0) {
        query = query.where(
          'ignore.title like :title or ignore.seasonTitle like :seasonTitle or ignore.episodeTitle like :episodeTitle',
          {
            title: `%${search}%`,
            seasonTitle: `%${search}%`,
            episodeTitle: `%${search}%`,
          }
        );
      }

      const [ignoredItems, itemsCount] = await query
        .orderBy('ignore.createdAt', 'DESC')
        .take(pageSize)
        .skip(skip)
        .getManyAndCount();

      return res.status(200).json({
        pageInfo: {
          pages: Math.ceil(itemsCount / pageSize),
          pageSize,
          results: itemsCount,
          page: Math.ceil(skip / pageSize) + 1,
        },
        results: ignoredItems,
      } as IgnoreResultsResponse);
    } catch (error) {
      logger.error('Something went wrong while retrieving ignored items', {
        label: 'Ignore',
        errorMessage: error.message,
      });
      return next({
        status: 500,
        message: 'Unable to retrieve ignored items.',
      });
    }
  }
);

ignoreRoutes.get(
  '/:id',
  isAuthenticated([Permission.MANAGE_BLACKLIST], {
    type: 'or',
  }),
  async (req, res, next) => {
    try {
      const ignoreRepository = getRepository(Ignore);

      const ignoreItem = await ignoreRepository.find({
        where: { tmdbId: Number(req.params.id) },
      });

      return res.status(200).send(ignoreItem);
    } catch (e) {
      if (e instanceof EntityNotFoundError) {
        return next({
          status: 401,
          message: e.message,
        });
      }
      return next({ status: 500, message: e.message });
    }
  }
);

ignoreRoutes.post(
  '/',
  isAuthenticated([Permission.MANAGE_BLACKLIST], {
    type: 'or',
  }),
  async (req, res, next) => {
    try {
      const values = ignoreAdd.parse(req.body);

      await Ignore.addToIgnore({
        ignoreRequest: values,
      });

      return res.status(201).send();
    } catch (error) {
      if (!(error instanceof Error)) {
        return;
      }

      if (error instanceof QueryFailedError) {
        switch (error.driverError.errno) {
          case 19:
            return next({ status: 412, message: 'Item already ignored' });
          default:
            logger.warn('Something wrong with data ignore', {
              tmdbId: req.body.tmdbId,
              mediaType: req.body.mediaType,
              label: 'Ignore',
            });
            return next({ status: 409, message: 'Something wrong' });
        }
      }

      return next({ status: 500, message: error.message });
    }
  }
);

ignoreRoutes.delete(
  '/',
  isAuthenticated([Permission.MANAGE_BLACKLIST], {
    type: 'or',
  }),
  async (req, res, next) => {
    try {
      const ignoreRepository = getRepository(Ignore);

      const ignoreItem = await ignoreRepository.findOneOrFail({
        where: {
          tmdbId: Number(req.body.tmdbId),
          seasonNumber: Number(req.body.seasonNumber),
          episodeNumber: Number(req.body.episodeNumber),
        },
      });
      await ignoreRepository.remove(ignoreItem);

      const mediaRepository = getRepository(Media);
      const media = await mediaRepository.findOne({
        where: {
          tmdbId: req.body.tmdbId,
        },
      });

      if (!media) return;

      const season = media.seasons.find(
        (s) => s.seasonNumber === Number(req.body.seasonNumber)
      );

      if (!season) return;

      const episode = season.episodes.find(
        (e) => e.episodeNumber === Number(req.body.episodeNumber)
      );

      if (!episode) return;

      const episodeRepository = getRepository(Episode);

      episode.status =
        episode.part === '[]' &&
        episode.ratingKey === '' &&
        (season.status === MediaStatus.AVAILABLE ||
          season.status === MediaStatus.PARTIALLY_AVAILABLE)
          ? MediaStatus.MISSING
          : MediaStatus.UNKNOWN;
      episode.status4k =
        episode.part === '[]' &&
        episode.ratingKey === '' &&
        (season.status4k === MediaStatus.AVAILABLE ||
          season.status4k === MediaStatus.PARTIALLY_AVAILABLE)
          ? MediaStatus.MISSING
          : MediaStatus.UNKNOWN;

      await episodeRepository.save(episode);

      const seasonRepository = getRepository(Season);

      const season2 = await seasonRepository.findOne({
        where: {
          media: { id: media?.id },
          seasonNumber: req.body.seasonNumber,
        },
      });

      if (!season2) return;

      season2.status = season2.episodes.some(
        (episode) => episode.status === MediaStatus.MISSING
      )
        ? MediaStatus.PARTIALLY_AVAILABLE
        : season2.episodes.every(
            (episode) => episode.status === MediaStatus.UNKNOWN
          )
        ? MediaStatus.UNKNOWN
        : season2.status;
      season2.status4k = season2.episodes.some(
        (episode) => episode.status4k === MediaStatus.MISSING
      )
        ? MediaStatus.PARTIALLY_AVAILABLE
        : season2.episodes.every(
            (episode) => episode.status4k === MediaStatus.UNKNOWN
          )
        ? MediaStatus.UNKNOWN
        : season2.status4k;

      await seasonRepository.save(season2);

      const media2 = await mediaRepository.findOne({
        where: {
          tmdbId: req.body.tmdbId,
        },
      });

      if (!media2) return;

      const isAllStandardSeasons =
        media2.seasons.length &&
        media2.seasons
          .filter((season) => season.episodes.length > 0)
          .every((season) =>
            season.episodes
              .filter((episode) => episode.status !== MediaStatus.IGNORED)
              .every((episode) => episode.status === MediaStatus.AVAILABLE)
          );

      const isAll4kSeasons =
        media2.seasons.length &&
        media2.seasons
          .filter((season) => season.episodes.length > 0)
          .every((season) =>
            season.episodes
              .filter((episode) => episode.status4k !== MediaStatus.IGNORED)
              .every((episode) => episode.status4k === MediaStatus.AVAILABLE)
          );

      media2.status = isAllStandardSeasons
        ? MediaStatus.AVAILABLE
        : media2.seasons.some(
            (season) =>
              season.status === MediaStatus.PARTIALLY_AVAILABLE ||
              season.status === MediaStatus.AVAILABLE
          )
        ? MediaStatus.PARTIALLY_AVAILABLE
        : media2.seasons.some(
            (season) => season.status === MediaStatus.PROCESSING
          )
        ? MediaStatus.PROCESSING
        : MediaStatus.UNKNOWN;
      media2.status4k = isAll4kSeasons
        ? MediaStatus.AVAILABLE
        : media2.seasons.some(
            (season) =>
              season.status4k === MediaStatus.PARTIALLY_AVAILABLE ||
              season.status4k === MediaStatus.AVAILABLE
          )
        ? MediaStatus.PARTIALLY_AVAILABLE
        : media2.seasons.some(
            (season) => season.status4k === MediaStatus.PROCESSING
          )
        ? MediaStatus.PROCESSING
        : MediaStatus.UNKNOWN;

      await mediaRepository.save(media2);

      return res.status(204).send();
    } catch (e) {
      if (e instanceof EntityNotFoundError) {
        return next({
          status: 401,
          message: e.message,
        });
      }
      return next({ status: 500, message: e.message });
    }
  }
);

export default ignoreRoutes;
