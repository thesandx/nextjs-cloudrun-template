import { Footer } from 'nextjs-cloudrun-template';

export const WithContact = () => (
  <div className="bg-paper">
    <Footer
      links={[
        { href: '/privacy', label: 'Privacy' },
        { href: '/api/health', label: 'Health' },
      ]}
      owner="Playroom"
      contact={{ phone: '+91 98765 43210', email: 'hello@playroom.test' }}
    >
      Built from the Cloud Run template.
    </Footer>
  </div>
);

export const Minimal = () => (
  <div className="bg-paper">
    <Footer owner="Playroom" since={2024} />
  </div>
);
