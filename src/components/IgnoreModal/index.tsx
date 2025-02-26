import Modal from '@app/components/Common/Modal';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import type { SeasonWithEpisodes, TvDetails } from '@server/models/Tv';
import { useIntl } from 'react-intl';

interface IgnoreModalProps {
  tv: TvDetails;
  season: SeasonWithEpisodes;
  episodeNumber: number | null;
  show: boolean;
  onComplete?: () => void;
  onCancel?: () => void;
  isUpdating?: boolean;
}

const messages = defineMessages('component.IgnoreModal', {
  ignoring: 'Ignoring',
});

const IgnoreModal = ({
  tv,
  season,
  episodeNumber,
  show,
  onComplete,
  onCancel,
  isUpdating,
}: IgnoreModalProps) => {
  const intl = useIntl();

  const episode = episodeNumber
    ? season.episodes[episodeNumber - 1].name
    : null;

  return (
    <Transition
      as="div"
      enter="transition-opacity duration-300"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="transition-opacity duration-300"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
      show={show}
    >
      <Modal
        loading={!tv}
        backgroundClickable
        title={`${intl.formatMessage(
          globalMessages.ignore
        )} ${intl.formatMessage(globalMessages.episode)}`}
        subTitle={`${tv?.name} - ${episode}`}
        onCancel={onCancel}
        onOk={onComplete}
        okText={
          isUpdating
            ? intl.formatMessage(messages.ignoring)
            : intl.formatMessage(globalMessages.ignore)
        }
        okButtonType="danger"
        okDisabled={isUpdating}
        backdrop={`https://image.tmdb.org/t/p/w1920_and_h800_multi_faces/${tv?.backdropPath}`}
      />
    </Transition>
  );
};

export default IgnoreModal;
