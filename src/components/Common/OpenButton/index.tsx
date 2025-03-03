import EmbyLogo from '@app/assets/services/emby.svg';
import JellyfinLogo from '@app/assets/services/jellyfin.svg';
import PlexLogo from '@app/assets/services/plex.svg';
import Badge from '@app/components/Common/Badge';
import ButtonWithDropdown from '@app/components/Common/ButtonWithDropdown';
import Tooltip from '@app/components/Common/Tooltip';
import useSettings from '@app/hooks/useSettings';
import { MediaServerType } from '@server/constants/server';

interface OpenButtonProps {
  is4k?: boolean;
  className?: string;
  links: OpenButtonLink[];
}

export interface OpenButtonLink {
  text: string;
  tooltip: string;
  url: string;
  svg: React.ReactNode;
}

const OpenButton = ({ className, links, is4k = false }: OpenButtonProps) => {
  const settings = useSettings();
  if (!links || !links.length) {
    return null;
  }

  return (
    <ButtonWithDropdown
      as="div"
      buttonType="ghost"
      className={`${className}`}
      text={
        settings.currentSettings.mediaServerType === MediaServerType.PLEX ? (
          <>
            <PlexLogo
              style={{
                width: className?.includes('button-sm') ? '40px' : '50px',
              }}
            />
            {is4k && (
              <Badge className="!px-1 !leading-none" badgeType="danger">
                4k
              </Badge>
            )}
          </>
        ) : settings.currentSettings.mediaServerType ===
          MediaServerType.EMBY ? (
          <EmbyLogo style={{ width: '30px', height: '30px' }} />
        ) : (
          <JellyfinLogo style={{ width: '30px', height: '30px' }} />
        )
      }
    >
      {links &&
        links.map((link, i) => {
          return (
            <Tooltip
              content={link.tooltip}
              key={`open-button-dropdown-item-${i}`}
            >
              <div>
                <ButtonWithDropdown.Item
                  buttonType="ghost"
                  href={link.url}
                  target="_blank"
                >
                  {link.svg}
                  <span>{link.text}</span>
                </ButtonWithDropdown.Item>
              </div>
            </Tooltip>
          );
        })}
    </ButtonWithDropdown>
  );
};

export default OpenButton;
