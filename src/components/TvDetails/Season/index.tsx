import AirDateBadge from '@app/components/AirDateBadge';
import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import type { OpenButtonLink } from '@app/components/Common/OpenButton';
import OpenButton from '@app/components/Common/OpenButton';
import StatusBadgeMini from '@app/components/Common/StatusBadgeMini';
import Tooltip from '@app/components/Common/Tooltip';
import IgnoreModal from '@app/components/IgnoreModal';
import useSettings from '@app/hooks/useSettings';
import { Permission, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { FolderOpenIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { MediaStatus } from '@server/constants/media';
import { MediaServerType } from '@server/constants/server';
import type Episode from '@server/entity/Episode';
import type { default as SeasonEntity } from '@server/entity/Season';
import type {
  Episode as EpisodeEntity,
  SeasonWithEpisodes,
  TvDetails,
} from '@server/models/Tv';
import Image from 'next/image';
import { useCallback, useState } from 'react';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
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
  episodeLink?: Partial<Episode>[] | null;
  tv: TvDetails;
  ignore: boolean;
  onUpdate: () => void;
};

const Season = ({
  seasonNumber,
  tv,
  season,
  episodeLink,
  ignore,
  onUpdate,
}: SeasonProps) => {
  const intl = useIntl();
  const settings = useSettings();
  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR<SeasonWithEpisodes>(`/api/v1/tv/${tv.id}/season/${seasonNumber}`);
  const { user, hasPermission } = useUser();
  const [selectedEpisode, setSelectedEpisode] = useState<EpisodeEntity | null>(
    null
  );
  const [isIgnoreUpdating, setIsIgnoreUpdating] = useState<boolean>(false);
  const [showIgnoreModal, setShowIgnoreModal] = useState(false);
  const { addToast } = useToasts();

  const closeIgnoreModal = useCallback(() => {
    setShowIgnoreModal(false);
    setSelectedEpisode(null);
  }, []);

  const showIgnoreButton = hasPermission(Permission.ADMIN);

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

  const onClickIgnoreItemBtn = async (): Promise<void> => {
    if (!selectedEpisode) return;
    setIsIgnoreUpdating(true);

    const res = await fetch('/api/v1/ignore', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tmdbId: tv.id,
        seasonNumber: data?.seasonNumber,
        seasonTitle: data?.name,
        episodeNumber: selectedEpisode?.episodeNumber,
        episodeTitle: selectedEpisode?.name,
        user: user?.id,
      }),
    });

    if (res.status === 201) {
      addToast(
        <span>
          {intl.formatMessage(globalMessages.ignoreSuccess, {
            title: tv.name,
            strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
          })}
        </span>,
        { appearance: 'success', autoDismiss: true }
      );

      revalidate();
    } else if (res.status === 412) {
      addToast(
        <span>
          {intl.formatMessage(globalMessages.ignoreDuplicateError, {
            title: tv.name,
            strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
          })}
        </span>,
        { appearance: 'info', autoDismiss: true }
      );
    } else {
      addToast(intl.formatMessage(globalMessages.ignoreError), {
        appearance: 'error',
        autoDismiss: true,
      });
    }

    onUpdate && onUpdate();

    setIsIgnoreUpdating(false);
    closeIgnoreModal();
  };

  return (
    <div className="flex flex-col justify-center divide-y divide-gray-700">
      <IgnoreModal
        tv={tv}
        season={data}
        episodeNumber={selectedEpisode?.episodeNumber || null}
        show={showIgnoreModal}
        onCancel={closeIgnoreModal}
        onComplete={onClickIgnoreItemBtn}
        isUpdating={isIgnoreUpdating}
      />
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
            if (episodeData?.status === MediaStatus.IGNORED) return;
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
                  text: getAvalaibleMediaServerName(matchingFile?.library),
                  tooltip: extractedText,
                  url: url,
                  svg: <FolderOpenIcon />,
                });
              });
            }
            const airsrelative = episode.airDate
              ? new Date(episode.airDate).getTime() < new Date().getTime()
              : false;

            const shouldShowIgnoreButton = () => {
              if (!showIgnoreButton || !episodeData?.status) return false;

              const invalidStatuses: MediaStatus[] = [
                MediaStatus.PROCESSING,
                MediaStatus.AVAILABLE,
                MediaStatus.PARTIALLY_AVAILABLE,
                MediaStatus.PENDING,
                MediaStatus.BLACKLISTED,
                MediaStatus.IGNORED,
              ];

              return !invalidStatuses.includes(episodeData.status) && ignore;
            };

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
                    {shouldShowIgnoreButton() &&
                      hasPermission(Permission.ADMIN) && (
                        <Tooltip
                          content={intl.formatMessage(
                            globalMessages.addToIgnore
                          )}
                        >
                          <Button
                            buttonType={'ghost'}
                            className="z-40 mr-2"
                            buttonSize={'sm'}
                            onClick={() => {
                              setSelectedEpisode(episode || null);
                              setShowIgnoreModal(true);
                            }}
                          >
                            <XMarkIcon className={'h-3'} />
                          </Button>
                        </Tooltip>
                      )}
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
