import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import Header from '@app/components/Common/Header';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import Tooltip from '@app/components/Common/Tooltip';
import StatusBadge from '@app/components/StatusBadge';
import useDeepLinks from '@app/hooks/useDeepLinks';
import useSettings from '@app/hooks/useSettings';
import { useUpdateQueryParams } from '@app/hooks/useUpdateQueryParams';
import globalMessages from '@app/i18n/globalMessages';
import Error from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  Bars3BottomLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FunnelIcon,
} from '@heroicons/react/24/solid';
import type Media from '@server/entity/Media';
import type { MediaResultsResponse } from '@server/interfaces/api/mediaInterfaces';
import type { MovieDetails } from '@server/models/Movie';
import type { TvDetails } from '@server/models/Tv';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.Library', {
  seasons: '{seasonCount, plural, one {Season} other {Seasons}}',
  sortAdded: 'Most Recent',
  sortModified: 'Last Modified',
  sortDirection: 'Toggle Sort Direction',
});

const isMovie = (movie: MovieDetails | TvDetails): movie is MovieDetails => {
  return (movie as MovieDetails).title !== undefined;
};

type Sort = 'mediaAdded' | 'modified';

type SortDirection = 'asc' | 'desc';

enum Filter {
  ALL = 'allavailable',
  AVAILABLE = 'available',
  PARTIALLY_AVAILABLE = 'partial',
  MIXED_AVAILABILITY = 'mixed',
}

enum Type {
  ALL = 'all',
  TV = 'tv',
  MOVIE = 'movie',
}

const Library = () => {
  const [currentPageSize, setCurrentPageSize] = useState<number>(10);
  const [currentFilter, setCurrentFilter] = useState<Filter>(Filter.ALL);
  const [currentType, setCurrentType] = useState<Type>(Type.ALL);
  const [currentSort, setCurrentSort] = useState<Sort>('mediaAdded');
  const [currentSortDirection, setCurrentSortDirection] =
    useState<SortDirection>('desc');
  const router = useRouter();
  const intl = useIntl();

  const page = router.query.page ? Number(router.query.page) : 1;
  const pageIndex = page - 1;
  const updateQueryParams = useUpdateQueryParams({ page: page.toString() });

  const { data, error } = useSWR<MediaResultsResponse>(
    `/api/v1/media/?take=${currentPageSize}&skip=${
      pageIndex * currentPageSize
    }${
      currentType !== undefined && currentType !== Type.ALL
        ? `&type=${currentType}`
        : ''
    }&filter=${currentFilter}&sort=${currentSort}&sortDirection=${currentSortDirection}`,
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
    }
  );

  // Restore last set filter values on component mount
  useEffect(() => {
    const filterString = window.localStorage.getItem('library-filter-settings');

    if (filterString) {
      const filterSettings = JSON.parse(filterString);

      setCurrentType(filterSettings.currentType);
      setCurrentFilter(filterSettings.currentFilter);
      setCurrentSort(filterSettings.currentSort);
      setCurrentPageSize(filterSettings.currentPageSize);
      if (['asc', 'desc'].includes(filterSettings.currentSortDirection)) {
        setCurrentSortDirection(filterSettings.currentSortDirection);
      }
    }

    // If filter value is provided in query, use that instead
    if (Object.values(Type).includes(router.query.type as Type)) {
      setCurrentType(router.query.type as Type);
    }

    // If filter value is provided in query, use that instead
    if (Object.values(Filter).includes(router.query.filter as Filter)) {
      setCurrentFilter(router.query.filter as Filter);
    }
  }, [router, router.query.type, router.query.filter]);

  // Set filter values to local storage any time they are changed
  useEffect(() => {
    window.localStorage.setItem(
      'library-filter-settings',
      JSON.stringify({
        currentType,
        currentFilter,
        currentSort,
        currentSortDirection,
        currentPageSize,
      })
    );
  }, [
    currentType,
    currentFilter,
    currentSort,
    currentSortDirection,
    currentPageSize,
  ]);

  // check if there's no data and no errors in the table
  // so as to show a spinner inside the table and not refresh the whole component
  if (!data && error) {
    return <Error statusCode={500} />;
  }

  const hasNextPage = data && data.pageInfo.pages > pageIndex + 1;
  const hasPrevPage = pageIndex > 0;

  return (
    <>
      <PageTitle title={[intl.formatMessage(globalMessages.library)]} />

      <div className="mb-4 flex flex-col justify-between lg:flex-row lg:items-end">
        <Header>{intl.formatMessage(globalMessages.library)}</Header>
        <div className="mt-2 flex flex-grow flex-col sm:flex-row lg:flex-grow-0">
          <div className="mb-2 flex flex-grow sm:mb-0 sm:mr-2 lg:flex-grow-0">
            <span className="inline-flex cursor-default items-center rounded-l-md border border-r-0 border-gray-500 bg-gray-800 px-3 text-sm text-gray-100">
              <FunnelIcon className="h-6 w-6" />
            </span>
            <select
              id="type"
              name="type"
              onChange={(e) => {
                setCurrentType(e.target.value as Type);
                router.push({
                  pathname: router.pathname,
                  query: router.query.userId
                    ? { userId: router.query.userId }
                    : {},
                });
              }}
              value={currentType}
              className="rounded-r-only"
            >
              <option value="all">
                {intl.formatMessage(globalMessages.all)}
              </option>
              <option value="tv">
                {intl.formatMessage(globalMessages.tvshows)}
              </option>
              <option value="movie">
                {intl.formatMessage(globalMessages.movies)}
              </option>
            </select>
          </div>
          <div className="mb-2 flex flex-grow sm:mb-0 sm:mr-2 lg:flex-grow-0">
            <span className="inline-flex cursor-default items-center rounded-l-md border border-r-0 border-gray-500 bg-gray-800 px-3 text-sm text-gray-100">
              <FunnelIcon className="h-6 w-6" />
            </span>
            <select
              id="filter"
              name="filter"
              onChange={(e) => {
                setCurrentFilter(e.target.value as Filter);
                router.push({
                  pathname: router.pathname,
                  query: router.query.userId
                    ? { userId: router.query.userId }
                    : {},
                });
              }}
              value={currentFilter}
              className="rounded-r-only"
            >
              <option value="allavailable">
                {intl.formatMessage(globalMessages.all)}
              </option>
              <option value="available">
                {intl.formatMessage(globalMessages.available)}
              </option>
              <option value="partial">
                {intl.formatMessage(globalMessages.partiallyavailable)}
              </option>
              <option value="mixed">
                {intl.formatMessage(globalMessages.mixedavailability)}
              </option>
            </select>
          </div>
          <div className="mb-2 flex flex-grow sm:mb-0 lg:flex-grow-0">
            <span className="inline-flex cursor-default items-center rounded-l-md border border-r-0 border-gray-500 bg-gray-800 px-3 text-gray-100 sm:text-sm">
              <Bars3BottomLeftIcon className="h-6 w-6" />
            </span>
            <select
              id="sort"
              name="sort"
              onChange={(e) => {
                setCurrentSort(e.target.value as Sort);
                router.push({
                  pathname: router.pathname,
                  query: router.query.userId
                    ? { userId: router.query.userId }
                    : {},
                });
              }}
              value={currentSort}
              className="rounded-none border-r-0"
            >
              <option value="mediaAdded">
                {intl.formatMessage(messages.sortAdded)}
              </option>
              <option value="modified">
                {intl.formatMessage(messages.sortModified)}
              </option>
            </select>
            <Tooltip content={intl.formatMessage(messages.sortDirection)}>
              <Button
                buttonType="default"
                className="z-40 mr-2 rounded-l-none border !border-gray-500 !bg-gray-800 !px-3 !text-gray-500 hover:!bg-gray-400 hover:!text-white"
                buttonSize="md"
                onClick={() =>
                  setCurrentSortDirection(
                    currentSortDirection === 'asc' ? 'desc' : 'asc'
                  )
                }
              >
                {currentSortDirection === 'asc' ? (
                  <ArrowUpIcon className="h-6 w-6" />
                ) : (
                  <ArrowDownIcon className="h-6 w-6" />
                )}
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>

      {!data ? (
        <LoadingSpinner />
      ) : data.results.length === 0 ? (
        <div className="flex w-full flex-col items-center justify-center py-24 text-white">
          <span className="text-2xl text-gray-400">
            {intl.formatMessage(globalMessages.noresults)}
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap items-start gap-4">
          {data.results.map((item) => {
            return (
              <LibraryItem key={`request-list-${item.tmdbId}`} item={item} />
            );
          })}
        </div>
      )}

      <div className="actions">
        <nav
          className="mb-3 flex flex-col items-center space-y-3 sm:flex-row sm:space-y-0"
          aria-label="Pagination"
        >
          <div className="hidden lg:flex lg:flex-1">
            <p className="text-sm">
              {data &&
                (data?.results.length ?? 0) > 0 &&
                intl.formatMessage(globalMessages.showingresults, {
                  from: pageIndex * currentPageSize + 1,
                  to:
                    data.results.length < currentPageSize
                      ? pageIndex * currentPageSize + data.results.length
                      : (pageIndex + 1) * currentPageSize,
                  total: data.pageInfo.results,
                  strong: (msg: React.ReactNode) => (
                    <span className="font-medium">{msg}</span>
                  ),
                })}
            </p>
          </div>
          <div className="flex justify-center sm:flex-1 sm:justify-start lg:justify-center">
            <span className="-mt-3 items-center truncate text-sm sm:mt-0">
              {intl.formatMessage(globalMessages.resultsperpage, {
                pageSize: (
                  <select
                    id="pageSize"
                    name="pageSize"
                    onChange={(e) => {
                      setCurrentPageSize(Number(e.target.value));
                      router
                        .push({
                          pathname: router.pathname,
                          query: router.query.userId
                            ? { userId: router.query.userId }
                            : {},
                        })
                        .then(() => window.scrollTo(0, 0));
                    }}
                    value={currentPageSize}
                    className="short inline"
                  >
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                ),
              })}
            </span>
          </div>
          <div className="flex flex-auto justify-center space-x-2 sm:flex-1 sm:justify-end">
            <Button
              disabled={!hasPrevPage}
              onClick={() => updateQueryParams('page', (page - 1).toString())}
            >
              <ChevronLeftIcon />
              <span>{intl.formatMessage(globalMessages.previous)}</span>
            </Button>
            <Button
              disabled={!hasNextPage}
              onClick={() => updateQueryParams('page', (page + 1).toString())}
            >
              <span>{intl.formatMessage(globalMessages.next)}</span>
              <ChevronRightIcon />
            </Button>
          </div>
        </nav>
      </div>
    </>
  );
};

export default Library;

interface LibraryItemProps {
  item: Media;
}

const LibraryItem = ({ item }: LibraryItemProps) => {
  const settings = useSettings();
  const { ref, inView } = useInView({
    triggerOnce: true,
  });
  const intl = useIntl();

  const url =
    item.mediaType === 'movie'
      ? `/api/v1/movie/${item.tmdbId}`
      : `/api/v1/tv/${item.tmdbId}`;
  const { data: title, error } = useSWR<MovieDetails | TvDetails>(
    inView ? url : null
  );

  const deepLinks = useDeepLinks(item);

  if (!deepLinks) return null;

  if (!title && !error) {
    return (
      <div
        className="h-64 w-full animate-pulse rounded-xl bg-gray-800 xl:h-28"
        ref={ref}
      />
    );
  }

  return (
    <div className="relative flex w-full max-w-sm overflow-hidden rounded-xl bg-gray-800 bg-cover bg-center p-4 text-gray-400 shadow ring-1 ring-gray-700 sm:w-96">
      {title && title.backdropPath && (
        <div className="absolute inset-0 z-0">
          <CachedImage
            type="tmdb"
            src={`https://image.tmdb.org/t/p/w1920_and_h800_multi_faces/${title.backdropPath}`}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            fill
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(135deg, rgba(17, 24, 39, 0.47) 0%, rgba(17, 24, 39, 1) 75%)',
            }}
          />
        </div>
      )}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col pr-4">
        <div className="hidden text-xs font-medium text-white sm:flex">
          {title &&
            (isMovie(title) ? title.releaseDate : title.firstAirDate)?.slice(
              0,
              4
            )}
        </div>
        <Link
          href={
            item.mediaType === 'movie'
              ? `/movie/${item.tmdbId}`
              : `/tv/${item.tmdbId}`
          }
          className="overflow-hidden overflow-ellipsis whitespace-nowrap text-base font-bold text-white hover:underline sm:text-lg"
        >
          {title && (isMovie(title) ? title.title : title.name)}
        </Link>
        {title && !isMovie(title) && item.seasons.length > 0 && (
          <div className="my-0.5 items-center text-sm sm:my-1 sm:flex">
            <span className="mr-2 font-bold ">
              {intl.formatMessage(messages.seasons, {
                seasonCount:
                  (settings.currentSettings.enableSpecialEpisodes
                    ? title.seasons.length
                    : title.seasons.filter(
                        (season) => season.seasonNumber !== 0
                      ).length) === item.seasons.length
                    ? 0
                    : item.seasons.length,
              })}
            </span>
            <div className="hide-scrollbar max-w-full overflow-x-auto whitespace-nowrap">
              {title.seasons
                .filter(
                  (season) =>
                    season.seasonNumber !== 0 ||
                    settings.currentSettings.enableSpecialEpisodes
                )
                .map((season) => {
                  const seasonLinks = deepLinks.seasons.find(
                    (s) => s.seasonNumber === season.seasonNumber
                  );
                  const matchingSeason = item.seasons.find(
                    (s) => s.seasonNumber === season.seasonNumber
                  );

                  return matchingSeason?.episodes.length ? (
                    <span key={`season-${season.id}`} className="mr-2">
                      <StatusBadge
                        status={matchingSeason?.status}
                        episode={
                          season.seasonNumber === 0
                            ? intl.formatMessage(globalMessages.specials)
                            : season.seasonNumber
                        }
                        title={
                          title && (isMovie(title) ? title.title : title.name)
                        }
                        tmdbId={item.tmdbId}
                        mediaType={item.mediaType}
                        plexUrl={seasonLinks?.mediaUrl ?? ''}
                      />
                    </span>
                  ) : null;
                })}
            </div>
          </div>
        )}
        <div className="mt-2 flex items-center text-sm sm:mt-1">
          <span className="mr-2 hidden font-bold sm:block">
            {intl.formatMessage(globalMessages.status)}
          </span>
          <StatusBadge
            status={item.status}
            downloadItem={item.downloadStatus}
            title={title && (isMovie(title) ? title.title : title.name)}
            inProgress={(item.downloadStatus ?? []).length > 0}
            is4k={false}
            tmdbId={item.tmdbId}
            mediaType={item.mediaType}
            plexUrl={deepLinks.mediaUrl}
            serviceUrl={''}
          />
        </div>
      </div>
      <Link
        href={
          item.mediaType === 'movie'
            ? `/movie/${item.tmdbId}`
            : `/tv/${item.tmdbId}`
        }
        className="w-[7rem] flex-shrink-0 scale-100 transform-gpu cursor-pointer overflow-hidden rounded-md shadow-sm transition duration-300 hover:scale-105 hover:shadow-md sm:w-[8rem]"
      >
        <CachedImage
          type="tmdb"
          src={
            title
              ? title.posterPath
                ? `https://image.tmdb.org/t/p/w600_and_h900_bestv2${title.posterPath}`
                : '/images/overseerr_poster_not_found.png'
              : ''
          }
          alt=""
          sizes="100vw"
          style={{ width: '100%', height: 'auto' }}
          width={600}
          height={900}
        />
      </Link>
    </div>
  );
};
