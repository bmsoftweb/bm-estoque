import React from 'react';
import { Link as RouterLink } from 'react-router-dom';

/** <Link href="..."> como nas telas; por baixo, o Link do React Router */
export default function Link({ href, ...resto }: { href: string } & Omit<React.ComponentProps<typeof RouterLink>, 'to'>) {
  return <RouterLink to={href} {...resto} />;
}
