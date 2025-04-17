import TmdbLogo from '@app/assets/tmdb_logo.svg';
import AirDateBadge from '@app/components/AirDateBadge';
import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import type { OpenButtonLink } from '@app/components/Common/OpenButton';
import OpenButton from '@app/components/Common/OpenButton';
import StatusBadgeMini from '@app/components/Common/StatusBadgeMini';
import Tooltip from '@app/components/Common/Tooltip';
import IgnoreModal from '@app/components/IgnoreModal';
import { Permission, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import type { SeasonWithEpisodes } from '@server/models/Tv';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR from 'swr';

const messages = defineMessages('components.TvDetails.Season', {
  somethingwentwrong: 'Something went wrong while retrieving season data.',
  noepisodes: 'Episode list unavailable.',
  play: 'Play on {mediaServerName}',
  open: 'Open on {mediaServerName}',
  status4k: '4K {status}',
  tmdbuserscore: 'TMDB User Score',
});

type SeasonProps = {
  seasonNumber: number;
  episodeLink?: Partial<Episode>[] | null;
  tv: TvDetails;
  onUpdate: () => void;
  allSeasonFiles: SeasonFile[];
  generateMediaLinks: (
    urls: string,
    targetArray: OpenButtonLink[],
    seasonFiles: MediaFile[],
    tautulliUrl: boolean
  ) => void;
};

interface MediaFile {
  file: string;
  keys: string[];
  library: string;
  editionText: string | null;
  audioText: string | null;
  subText: string | null;
}

type SeasonFile = {
  file: string;
  keys: string[];
  library: string;
  editionText: string | null;
  audioText: string | null;
  subText: string | null;
  uniqueAudio: string;
  uniqueSub: string;
};

const Season = ({
  seasonNumber,
  tv,
  episodeLink,
  onUpdate,
  allSeasonFiles,
  generateMediaLinks,
}: SeasonProps) => {
  const intl = useIntl();
  const { locale } = useLocale();
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
            const seasonData = tv.mediaInfo?.seasons?.find(
              (e) => e.seasonNumber === seasonNumber
            );
            const episodeData = seasonData?.episodes?.find(
              (e) => e.episodeNumber === episode.episodeNumber
            );
            if (episodeData?.status === MediaStatus.IGNORED) return;

            const episodeFiles = allSeasonFiles.filter(
              (file) =>
                episodeData?.part &&
                JSON.parse(episodeData.part).some((f: { key: string }) =>
                  f.key.split(/\s*,\s*/).includes(file.keys[0])
                )
            );

            const mediaEpisodeLinks: OpenButtonLink[] = [];
            const media4kEpisodeLinks: OpenButtonLink[] = [];

            if (episodeLinks?.mediaUrl)
              generateMediaLinks(
                episodeLinks.mediaUrl,
                mediaEpisodeLinks,
                episodeFiles,
                false
              );
            if (episodeLinks?.mediaUrl4k)
              generateMediaLinks(
                episodeLinks.mediaUrl4k,
                media4kEpisodeLinks,
                episodeFiles,
                false
              );

            const airsrelative = episode.airDate
              ? new Date(episode.airDate).getTime() < new Date().getTime()
              : false;

            const shouldShowIgnoreButton = () => {
              if (
                !showIgnoreButton ||
                !episodeData?.status ||
                !episodeData?.status4k
              )
                return false;

              const invalidStatuses: MediaStatus[] = [
                MediaStatus.PROCESSING,
                MediaStatus.AVAILABLE,
                MediaStatus.PARTIALLY_AVAILABLE,
                MediaStatus.PENDING,
                MediaStatus.BLACKLISTED,
                MediaStatus.IGNORED,
              ];

              return (
                !invalidStatuses.includes(episodeData.status) &&
                !invalidStatuses.includes(episodeData.status4k) &&
                !(
                  tv?.mediaInfo?.status === MediaStatus.UNKNOWN &&
                  tv?.mediaInfo?.status4k === MediaStatus.UNKNOWN
                ) &&
                !(
                  episodeData.status === MediaStatus.DISABLED &&
                  episodeData.status4k === MediaStatus.DISABLED
                )
              );
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
                    {shouldShowIgnoreButton() &&
                      hasPermission(Permission.ADMIN) && (
                        <Tooltip
                          content={intl.formatMessage(
                            globalMessages.addToIgnore
                          )}
                        >
                          <Button
                            buttonType={'ghost'}
                            className="z-40 mr-2 px-1 py-1"
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
                    {episodeData?.status4k === MediaStatus.AVAILABLE ? (
                      <>
                        <div className="hidden md:flex">
                          <Badge badgeType="success">
                            {intl.formatMessage(messages.status4k, {
                              status: intl.formatMessage(
                                globalMessages.available
                              ),
                            })}
                          </Badge>
                        </div>
                        <div className="flex md:hidden">
                          <StatusBadgeMini status={MediaStatus.AVAILABLE} />
                        </div>
                      </>
                    ) : episodeData?.status4k === MediaStatus.MISSING &&
                      airsrelative ? (
                      <>
                        <div className="hidden md:flex">
                          <Badge badgeType="danger">
                            {intl.formatMessage(messages.status4k, {
                              status: intl.formatMessage(
                                globalMessages.missing
                              ),
                            })}
                          </Badge>
                        </div>
                        <div className="flex md:hidden">
                          <StatusBadgeMini status={MediaStatus.MISSING} />
                        </div>
                      </>
                    ) : null}
                    <OpenButton
                      links={mediaEpisodeLinks}
                      className="button-sm w-full py-0 px-2"
                    />
                    <OpenButton
                      links={media4kEpisodeLinks}
                      className="button-sm w-full py-0 px-2"
                      is4k={true}
                    />
                  </div>
                  <div className="flex flex-col space-y-2 xl:flex-row xl:items-center xl:space-y-0 xl:space-x-2">
                    {episode.airDate && (
                      <AirDateBadge airDate={episode.airDate} />
                    )}
                    {!!episode.voteCount && (
                      <Tooltip
                        content={intl.formatMessage(messages.tmdbuserscore)}
                      >
                        <a
                          href={`https://www.themoviedb.org/tv/${tv.id}/season/${seasonNumber}/episode/${episode.episodeNumber}?language=${locale}`}
                          className="media-rating"
                          target="_blank"
                          rel="noreferrer"
                        >
                          <TmdbLogo className="mr-1 w-6" />
                          <span>{Math.round(episode.voteAverage * 10)}%</span>
                        </a>
                      </Tooltip>
                    )}
                  </div>
                  {episode.overview && <p>{episode.overview}</p>}

                  {seasonData &&
                  seasonData.episodes &&
                  seasonData.episodes.some(
                    (e) => e.episodeNumber === episode.episodeNumber
                  ) ? (
                    <div className="mt-2 flex flex-col space-y-2">
                      {seasonData.episodes.find(
                        (e) => e.episodeNumber === episode.episodeNumber
                      )?.part &&
                        JSON.parse(
                          seasonData.episodes.find(
                            (e) => e.episodeNumber === episode.episodeNumber
                          )?.part || '[]'
                        ).map(
                          (
                            p: {
                              file: string;
                              size: number;
                              container: string;
                              videoResolution: string;
                            },
                            index: number
                          ) => (
                            <Tooltip
                              key={index}
                              className=""
                              content={
                                <>
                                  <div>
                                    <strong>File:</strong>{' '}
                                    {p.file.split('/').pop()}
                                  </div>
                                  <div className="flex">
                                    <strong>Folder:</strong>
                                    <span className="inline-flex flex-wrap pl-2">
                                      <span className="block max-w-lg whitespace-pre-wrap break-words">
                                        {p.file.substring(
                                          0,
                                          p.file.lastIndexOf('/')
                                        )}
                                      </span>
                                    </span>
                                  </div>
                                  <div>
                                    <strong>Size:</strong>{' '}
                                    {p.size >= 1024 * 1024 * 1024
                                      ? (p.size / (1024 * 1024 * 1024)).toFixed(
                                          2
                                        ) + ' GB'
                                      : (p.size / (1024 * 1024)).toFixed(2) +
                                        ' MB'}
                                  </div>
                                  <div>
                                    <strong>Container:</strong>{' '}
                                    {p.container ?? 'N/A'}
                                  </div>
                                  <div>
                                    <strong>Resolution:</strong>{' '}
                                    {p.videoResolution ?? 'N/A'}
                                  </div>
                                </>
                              }
                            >
                              <div className="flex items-center">
                                <code className="flex-1 break-all">
                                  {p.file.split('/').pop()}
                                  <Badge className="ml-2">
                                    {p.size >= 1024 * 1024 * 1024
                                      ? (p.size / (1024 * 1024 * 1024)).toFixed(
                                          2
                                        ) + ' GB'
                                      : (p.size / (1024 * 1024)).toFixed(2) +
                                        ' MB'}
                                  </Badge>
                                  {p.videoResolution === '4k' && (
                                    <Badge className="ml-2" badgeType="danger">
                                      4k
                                    </Badge>
                                  )}
                                </code>
                              </div>
                            </Tooltip>
                          )
                        )}
                    </div>
                  ) : null}
                </div>
                {episode.stillPath && (
                  <div className="relative aspect-video xl:h-32">
                    <CachedImage
                      type="tmdb"
                      className="rounded-lg object-contain"
                      src={`https://image.tmdb.org/t/p/original/${episode.stillPath}`}
                      alt=""
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
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
