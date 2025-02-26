import Ignore from '@app/components/Ignore';
import useRouteGuard from '@app/hooks/useRouteGuard';
import { Permission } from '@server/lib/permissions';
import type { NextPage } from 'next';

const IgnorePage: NextPage = () => {
  useRouteGuard(Permission.ADMIN);
  return <Ignore />;
};

export default IgnorePage;
