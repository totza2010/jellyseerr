import ConfirmButton from '@app/components/Common/ConfirmButton';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import Tooltip from '@app/components/Common/Tooltip';
import { useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import {
  CameraIcon,
  ClockIcon,
  QuestionMarkCircleIcon,
  TrashIcon,
} from '@heroicons/react/24/solid';
import type { Ignore } from '@server/entity/Ignore';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR from 'swr';

interface IgnoreBlockProps {
  tmdbId: number;
  onUpdate?: () => void;
}

const IgnoreBlock = ({ tmdbId, onUpdate }: IgnoreBlockProps) => {
  const { user } = useUser();
  const intl = useIntl();
  const [isUpdating, setIsUpdating] = useState(false);
  const { addToast } = useToasts();
  const { data, mutate: revalidate } = useSWR<[Ignore]>(
    `/api/v1/ignore/${tmdbId}`
  );

  const removeFromIgnore = async (
    tmdbId: number,
    seasonNumber: number,
    episodeNumber: number,
    title?: string
  ) => {
    setIsUpdating(true);

    const res = await fetch('/api/v1/ignore', {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tmdbId: tmdbId,
        seasonNumber: seasonNumber,
        episodeNumber: episodeNumber,
        user: user?.id,
      }),
    });

    if (res.status === 204) {
      addToast(
        <span>
          {intl.formatMessage(globalMessages.removeFromIgnoreSuccess, {
            title,
            strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
          })}
        </span>,
        { appearance: 'success', autoDismiss: true }
      );

      revalidate();
    } else {
      addToast(intl.formatMessage(globalMessages.ignoreError), {
        appearance: 'error',
        autoDismiss: true,
      });
    }

    onUpdate && onUpdate();

    setIsUpdating(false);
  };

  if (!data) {
    return (
      <>
        <LoadingSpinner />
      </>
    );
  }

  return (
    <>
      {data.map((ignore) => (
        <div key={ignore.id} className="px-4 py-1 text-gray-300">
          <div className="flex items-center justify-between">
            <div className="mr-6 min-w-0 flex-1 flex-col items-center text-sm leading-5">
              <div className="white mb-1 flex flex-nowrap">
                <Tooltip
                  content={`${ignore.episodeTitle} (${ignore.seasonNumber
                    .toString()
                    .padStart(2, '0')}X${ignore.episodeNumber
                    .toString()
                    .padStart(2, '0')})`}
                >
                  <CameraIcon className="mr-1.5 h-5 w-5 min-w-0 flex-shrink-0" />
                </Tooltip>
                <span className="w-40 truncate md:w-auto">
                  <span className="font-semibold text-gray-100 transition duration-300 hover:text-white hover:underline">
                    {`${ignore.seasonNumber
                      .toString()
                      .padStart(2, '0')}X${ignore.episodeNumber
                      .toString()
                      .padStart(2, '0')}`}
                  </span>
                </span>
              </div>
            </div>
            <div className="ml-2 flex flex-shrink-0 flex-wrap">
              <Tooltip
                content={intl.formatMessage(globalMessages.removefromIgnore)}
              >
                <ConfirmButton
                  onClick={() =>
                    removeFromIgnore(
                      ignore.tmdbId,
                      ignore.seasonNumber,
                      ignore.episodeNumber,
                      ignore.title
                    )
                  }
                  confirmText={
                    isUpdating ? (
                      <ClockIcon className="icon-sm" />
                    ) : (
                      <QuestionMarkCircleIcon className="icon-sm" />
                    )
                  }
                  disabled={isUpdating}
                  buttonSize="sm"
                >
                  <TrashIcon className="icon-sm" />
                </ConfirmButton>
              </Tooltip>
            </div>
          </div>
        </div>
      ))}
    </>
  );
};

export default IgnoreBlock;
