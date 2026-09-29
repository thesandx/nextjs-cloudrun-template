import { ContactLink } from 'nextjs-cloudrun-template';

export const PhoneAndEmail = () => (
  <div className="flex flex-wrap gap-x-6">
    <ContactLink kind="phone" value="+91 98765 43210" />
    <ContactLink kind="email" value="hello@playroom.test" />
  </div>
);

export const InSentence = () => (
  <p className="max-w-md">
    Stuck on a round? Call <ContactLink kind="phone" value="+91 98765 43210" /> and we will help.
  </p>
);
