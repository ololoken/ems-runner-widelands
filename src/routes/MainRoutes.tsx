import Loadable from '../components/Loadable';
import MainLayout from '../layouts/MainLayout';
import { lazy } from 'react';

const Launcher = Loadable(lazy(() => import('../pages/Launcher')));

export default {
  path: `${import.meta.env.BASE_URL}`,
  children: [
    {
      element: <MainLayout />,
      children: [
        {
          path: '',
          element: <Launcher />
        }
      ]
    }
  ]
};
