import AirDateBadge from '@app/components/AirDateBadge';
import Badge from '@app/components/Common/Badge';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import type { OpenButtonLink } from '@app/components/Common/OpenButton';
import OpenButton from '@app/components/Common/OpenButton';
import StatusBadgeMini from '@app/components/Common/StatusBadgeMini';
import useSettings from '@app/hooks/useSettings';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { FolderOpenIcon } from '@heroicons/react/24/outline';
import { MediaStatus } from '@server/constants/media';
import { MediaServerType } from '@server/constants/server';
import type { default as EpisodeEntity } from '@server/entity/Episode';
import type { default as SeasonEntity } from '@server/entity/Season';
import type { SeasonWithEpisodes } from '@server/models/Tv';
import Image from 'next/image';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.TvDetails.Season', {
  somethingwentwrong: 'Something went wrong while retrieving season data.',
  noepisodes: 'Episode list unavailable.',
  play: 'Play on {mediaServerName}',
  open: 'Open on {mediaServerName}',
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
  const { data, error } = useSWR<SeasonWithEpisodes>(
    `/api/v1/tv/${tvId}/season/${seasonNumber}`
  );

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return <div>{intl.formatMessage(messages.somethingwentwrong)}</div>;
  }

  function getAvalaibleMediaServerName(library = '') {
    if (settings.currentSettings.mediaServerType === MediaServerType.EMBY) {
      return intl.formatMessage(library ? messages.open : messages.play, {
        mediaServerName: library ?? 'Emby',
      });
    }

    if (settings.currentSettings.mediaServerType === MediaServerType.PLEX) {
      return intl.formatMessage(library ? messages.open : messages.play, {
        mediaServerName: library ?? 'Plex',
      });
    }

    return intl.formatMessage(library ? messages.open : messages.play, {
      mediaServerName: library ?? 'Jellyfin',
    });
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
            const episodeData = season?.episodes?.find(
              (e) => e.episodeNumber === episode.episodeNumber
            );
            const episodeFile = episodeData?.part
              ? JSON.parse(episodeData.part)
              : [];

            const mediaSeasonLinks: OpenButtonLink[] = [];

            if (episodeLinks?.mediaUrl) {
              const mediaUrls = episodeLinks.mediaUrl
                .split(',')
                .map((url) => url.trim());

              mediaUrls.forEach((url) => {
                // ดึง ratingKey จาก mediaUrl
                const urlMatch = url.match(/metadata%2F(\d+)/);
                const urlRatingKey = urlMatch ? urlMatch[1] : '';

                // หาไฟล์ที่มี ratingKey ตรงกัน
                const matchingFile = episodeFile.find((file: { key: string }) =>
                  file.key.split(/\s*,\s*/).includes(urlRatingKey)
                );

                const selectedFile = matchingFile?.file || '';

                // Find [edition-*]
                const editionMatch = [
                  ...selectedFile.matchAll(/\[(edition-[^\]]+)]/g),
                ];
                const editionText =
                  editionMatch.length > 0
                    ? editionMatch[editionMatch.length - 1][1].replace(
                        'edition-',
                        ''
                      )
                    : null;

                // Find [Audio-*] and [Sub-*]
                const audioMatch = [
                  ...selectedFile.matchAll(/\[Audio-([^\]]+)]/g),
                ];
                const audioText =
                  audioMatch.length > 0
                    ? `🔊 Audio: ${audioMatch[audioMatch.length - 1][1]}`
                    : null;

                const subMatch = [...selectedFile.matchAll(/\[Sub-([^\]]+)]/g)];
                const subText =
                  subMatch.length > 0
                    ? `📝 Sub: ${subMatch[subMatch.length - 1][1]}`
                    : null;

                // sort by: edition > (Audio + Sub)
                let extractedText = editionText || null;

                if (!extractedText) {
                  extractedText =
                    [audioText, subText].filter(Boolean).join(' / ') ||
                    'Unknown';
                }

                mediaSeasonLinks.push({
                  text: getAvalaibleMediaServerName(matchingFile.library),
                  tooltip: extractedText,
                  url: url,
                  svg: <FolderOpenIcon />,
                });
              });
            }
            const airsrelative = episode.airDate
              ? new Date(episode.airDate).getTime() < new Date().getTime()
              : false;

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
                    {episodeData?.status === MediaStatus.AVAILABLE ? (
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
                    ) : episodeData?.status === MediaStatus.MISSING &&
                      airsrelative ? (
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
                    <OpenButton links={mediaSeasonLinks} />
                  </div>
                  {episode.overview && <p>{episode.overview}</p>}

                  {season &&
                  season.episodes &&
                  season.episodes.some(
                    (e) => e.episodeNumber === episode.episodeNumber
                  ) ? (
                    <div className="mt-2 flex flex-col space-y-2">
                      {season.episodes.find(
                        (e) => e.episodeNumber === episode.episodeNumber
                      )?.part &&
                        JSON.parse(
                          season.episodes.find(
                            (e) => e.episodeNumber === episode.episodeNumber
                          )?.part || '[]'
                        ).map(
                          (
                            p: { file: string; size: number },
                            index: number
                          ) => (
                            <div key={index} className="flex items-center">
                              <code className="flex-1 break-all">
                                {p.file}
                                <Badge className="ml-2">
                                  {p.size >= 1024 * 1024 * 1024
                                    ? (p.size / (1024 * 1024 * 1024)).toFixed(
                                        2
                                      ) + ' GB'
                                    : (p.size / (1024 * 1024)).toFixed(2) +
                                      ' MB'}
                                </Badge>
                              </code>
                            </div>
                          )
                        )}
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
