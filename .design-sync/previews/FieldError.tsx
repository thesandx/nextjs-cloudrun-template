import { FieldError } from 'nextjs-cloudrun-template';

export const Default = () => <FieldError>Keys are 6 letters or numbers.</FieldError>;

export const LongMessage = () => (
  <div className="max-w-md">
    <FieldError>That nickname is taken in this room. Try adding a number or an emoji.</FieldError>
  </div>
);
