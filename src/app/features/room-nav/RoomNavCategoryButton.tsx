import React from 'react';
import { as, Chip, Text } from 'folds';
import { CaretRight, CaretDown } from '@phosphor-icons/react';
import classNames from 'classnames';
import * as css from './styles.css';

export const RoomNavCategoryButton = as<'button', { closed?: boolean }>(
  ({ className, closed, children, ...props }, ref) => (
    <Chip
      className={classNames(css.CategoryButton, className)}
      variant="Background"
      radii="Pill"
      before={
        closed
          ? <CaretRight weight="bold" size={12} className={css.CategoryButtonIcon} />
          : <CaretDown weight="bold" size={12} className={css.CategoryButtonIcon} />
      }
      {...props}
      ref={ref}
    >
      <Text size="O400" priority="300" truncate>
        {children}
      </Text>
    </Chip>
  )
);
