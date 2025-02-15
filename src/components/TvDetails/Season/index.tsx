import AirDateBadge from '@app/components/AirDateBadge';
import Badge from '@app/components/Common/Badge';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import type { PlayButtonLink } from '@app/components/Common/PlayButton';
import PlayButton from '@app/components/Common/PlayButton';
import StatusBadgeMini from '@app/components/Common/StatusBadgeMini';
import useSettings from '@app/hooks/useSettings';
import { useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { PlayIcon } from '@heroicons/react/24/outline';
import { MediaStatus } from '@server/constants/media';
import { MediaServerType } from '@server/constants/server';
import type { default as EpisodeEntity } from '@server/entity/Episode';
import type { default as SeasonEntity } from '@server/entity/Season';
import { Permission } from '@server/lib/permissions';
import type { SeasonWithEpisodes } from '@server/models/Tv';
import Image from 'next/image';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.TvDetails.Season', {
  somethingwentwrong: 'Something went wrong while retrieving season data.',
  noepisodes: 'Episode list unavailable.',
  play: 'Play on {mediaServerName}',
});

type SeasonProps = {
  seasonNumber: number;
  season?: SeasonEntity | null;
  episodeLink?: Partial<EpisodeEntity>[] | null;
  tvId: number;
};

const Season = ({ seasonNumber, tvId, season, episodeLink }: SeasonProps) => {
  const intl = useIntl();
  const settings = useSettings();
  const { hasPermission } = useUser();
  const { data, error } = useSWR<SeasonWithEpisodes>(
    `/api/v1/tv/${tvId}/season/${seasonNumber}`
  );

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return <div>{intl.formatMessage(messages.somethingwentwrong)}</div>;
  }

  function getAvalaibleMediaServerName() {
    if (settings.currentSettings.mediaServerType === MediaServerType.EMBY) {
      return intl.formatMessage(messages.play, { mediaServerName: 'Emby' });
    }

    if (settings.currentSettings.mediaServerType === MediaServerType.PLEX) {
      return intl.formatMessage(messages.play, { mediaServerName: 'Plex' });
    }

    return intl.formatMessage(messages.play, { mediaServerName: 'Jellyfin' });
  }

  return (
    <div className="flex flex-col justify-center divide-y divide-gray-700">
      {data.episodes.length === 0 ? (
        <p>{intl.formatMessage(messages.noepisodes)}</p>
      ) : (
        data.episodes
          .slice()
          .reverse()
          .map((episode) => {
            const episodeLinks = episodeLink?.find(
              (s) => s.episodeNumber === episode.episodeNumber
            );

            const mediaSeasonLinks: PlayButtonLink[] = [];

            if (
              episodeLinks?.mediaUrl &&
              hasPermission([Permission.REQUEST, Permission.REQUEST_TV], {
                type: 'or',
              })
            ) {
              if (episodeLinks && episodeLinks.mediaUrl) {
                mediaSeasonLinks.push({
                  text: getAvalaibleMediaServerName(),
                  url: episodeLinks.mediaUrl,
                  svg: <PlayIcon />,
                });
              }
            }
            return (
              <div
                className="flex flex-col space-y-4 py-4 xl:flex-row xl:space-y-4 xl:space-x-4"
                key={`season-${seasonNumber}-episode-${episode.episodeNumber}`}
              >
                <div className="flex-1">
                  <div className="flex flex-col space-y-2 xl:flex-row xl:items-center xl:space-y-0 xl:space-x-2">
                    <h3 className="text-lg">
                      {episode.episodeNumber} - {episode.name}
                    </h3>
                    {episode.airDate && (
                      <AirDateBadge airDate={episode.airDate} />
                    )}
                    {season &&
                    season.episodes &&
                    season.episodes.some(
                      (e) => e.episodeNumber === episode.episodeNumber
                    ) ? (
                      <>
                        <div className="hidden md:flex">
                          <Badge badgeType="success">
                            {intl.formatMessage(globalMessages.available)}
                          </Badge>
                        </div>
                        <div className="flex md:hidden">
                          <StatusBadgeMini status={MediaStatus.AVAILABLE} />
                        </div>
                      </>
                    ) : season ? (
                      <>
                        <div className="hidden md:flex">
                          <Badge badgeType="danger">
                            {intl.formatMessage(globalMessages.missing)}
                          </Badge>
                        </div>
                        <div className="flex md:hidden">
                          <StatusBadgeMini status={MediaStatus.MISSING} />
                        </div>
                      </>
                    ) : null}
                    <PlayButton links={mediaSeasonLinks} />
                  </div>
                  {episode.overview && <p>{episode.overview}</p>}

                  {season &&
                  season.episodes &&
                  season.episodes.some(
                    (e) => e.episodeNumber === episode.episodeNumber
                  ) ? (
                    <div className="mt-2 flex flex-col space-y-2">
                      {season.episodes
                        .find((e) => e.episodeNumber === episode.episodeNumber)
                        ?.part.map((p, index) => (
                          <div key={index} className="flex items-center">
                            <code className="flex-1 break-all">
                              {p.file}
                              <Badge className="ml-2">
                                {p.size >= 1024 * 1024 * 1024
                                  ? (p.size / (1024 * 1024 * 1024)).toFixed(2) +
                                    ' GB'
                                  : (p.size / (1024 * 1024)).toFixed(2) + ' MB'}
                              </Badge>
                            </code>
                          </div>
                        ))}
                    </div>
                  ) : null}
                </div>
                {episode.stillPath && (
                  <div className="relative aspect-video xl:h-32">
                    <Image
                      className="rounded-lg object-contain"
                      src={`https://image.tmdb.org/t/p/original/${episode.stillPath}`}
                      alt=""
                      fill
                    />
                  </div>
                )}
              </div>
            );
          })
      )}
    </div>
  );
};

export default Season;
