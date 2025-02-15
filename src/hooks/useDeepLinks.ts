import useSettings from '@app/hooks/useSettings';
import { MediaServerType } from '@server/constants/server';
import { useEffect, useState } from 'react';

interface Episode {
  episodeNumber: number;
  mediaUrl?: string;
  mediaUrl4k?: string;
  iOSPlexUrl?: string;
  iOSPlexUrl4k?: string;
}

interface Season {
  seasonNumber: number;
  mediaUrl?: string;
  mediaUrl4k?: string;
  iOSPlexUrl?: string;
  iOSPlexUrl4k?: string;
  episodes: Episode[];
}

interface MediaInfo {
  mediaUrl?: string;
  mediaUrl4k?: string;
  iOSPlexUrl?: string;
  iOSPlexUrl4k?: string;
  seasons: Season[];
}

const useDeepLinks = (mediaInfo?: MediaInfo) => {
  const [deepLinks, setDeepLinks] = useState<MediaInfo>({
    mediaUrl: '',
    mediaUrl4k: '',
    seasons: [],
  });
  const settings = useSettings();

  useEffect(() => {
    if (!mediaInfo) {
      setDeepLinks({
        mediaUrl: '',
        mediaUrl4k: '',
        seasons: [],
      });
      return;
    }

    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.userAgent.includes('Mac') && navigator.maxTouchPoints > 1);

    const shouldUseIOSLinks =
      settings.currentSettings.mediaServerType === MediaServerType.PLEX &&
      isIOS;

    const getLink = (item?: {
      mediaUrl?: string;
      mediaUrl4k?: string;
      iOSPlexUrl?: string;
      iOSPlexUrl4k?: string;
    }) => ({
      mediaUrl: shouldUseIOSLinks ? item?.iOSPlexUrl : item?.mediaUrl,
      mediaUrl4k: shouldUseIOSLinks ? item?.iOSPlexUrl4k : item?.mediaUrl4k,
    });

    const updatedDeepLinks: MediaInfo = {
      ...getLink(mediaInfo),
      seasons: (mediaInfo?.seasons ?? []).map((season) => ({
        seasonNumber: season.seasonNumber,
        ...getLink(season),
        episodes: (season.episodes ?? []).map((episode) => ({
          episodeNumber: episode.episodeNumber,
          ...getLink(episode),
        })),
      })),
    };

    setDeepLinks(updatedDeepLinks);
  }, [mediaInfo, settings.currentSettings.mediaServerType]);

  return deepLinks;
};

export default useDeepLinks;
