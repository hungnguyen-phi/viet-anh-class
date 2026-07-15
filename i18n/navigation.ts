import {createNavigation} from 'next-intl/navigation';
import {routing} from './routing';

// Wrapper Link/redirect/usePathname/useRouter hiểu locale (dùng thay cho next/navigation).
export const {Link, redirect, usePathname, useRouter, getPathname} =
  createNavigation(routing);
