import { MediaStatus } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import { Ignore } from '@server/entity/Ignore';
import Media from '@server/entity/Media';
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
  isAuthenticated(Permission.ADMIN),
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
  isAuthenticated(Permission.ADMIN),
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
  isAuthenticated(Permission.ADMIN),
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
  isAuthenticated(Permission.ADMIN),
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

      const episodeStatus =
        episode.part && episode.ratingKey
          ? MediaStatus.AVAILABLE
          : season.episodes.some((s) => s.ratingKey)
          ? MediaStatus.MISSING
          : MediaStatus.UNKNOWN;

      const episodeStatus4k =
        episode.part && episode.ratingKey
          ? MediaStatus.AVAILABLE
          : season.episodes.some((s) => s.ratingKey)
          ? MediaStatus.MISSING
          : MediaStatus.UNKNOWN;

      episode.status = episodeStatus;
      episode.status4k = episodeStatus4k;

      season.status = season.episodes.some(
        (e) => e.status === MediaStatus.MISSING
      )
        ? MediaStatus.PARTIALLY_AVAILABLE
        : season.episodes.every((e) => e.status === MediaStatus.UNKNOWN)
        ? MediaStatus.UNKNOWN
        : season.status;
      season.status4k = season.episodes.some(
        (e) => e.status4k === MediaStatus.MISSING
      )
        ? MediaStatus.PARTIALLY_AVAILABLE
        : season.episodes.every((e) => e.status4k === MediaStatus.UNKNOWN)
        ? MediaStatus.UNKNOWN
        : season.status4k;

      const isAllStandardSeasons =
        media.seasons.length &&
        media.seasons
          .filter(
            (s) =>
              s.episodes.filter((e) => e.status !== MediaStatus.IGNORED)
                .length > 0
          )
          .every((s) => s.status === MediaStatus.AVAILABLE)
          ? MediaStatus.AVAILABLE
          : media.seasons.some(
              (s) =>
                s.status === MediaStatus.PARTIALLY_AVAILABLE ||
                s.status === MediaStatus.MIXED_AVAILABILITY ||
                s.status === MediaStatus.AVAILABLE
            )
          ? MediaStatus.PARTIALLY_AVAILABLE
          : media.seasons.some((s) => s.status === MediaStatus.PROCESSING)
          ? MediaStatus.PROCESSING
          : MediaStatus.UNKNOWN;

      const isAll4kSeasons =
        media.seasons.length &&
        media.seasons
          .filter(
            (s) =>
              s.episodes.filter((e) => e.status4k !== MediaStatus.IGNORED)
                .length > 0
          )
          .every((s) => s.status4k === MediaStatus.AVAILABLE)
          ? MediaStatus.AVAILABLE
          : media.seasons.some(
              (s) =>
                s.status4k === MediaStatus.PARTIALLY_AVAILABLE ||
                s.status4k === MediaStatus.MIXED_AVAILABILITY ||
                s.status4k === MediaStatus.AVAILABLE
            )
          ? MediaStatus.PARTIALLY_AVAILABLE
          : media.seasons.some((s) => s.status4k === MediaStatus.PROCESSING)
          ? MediaStatus.PROCESSING
          : MediaStatus.UNKNOWN;

      media.status = isAllStandardSeasons;
      media.status4k = isAll4kSeasons;

      await mediaRepository.save(media);

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
