import type { Metadata } from 'next';
import { LegalDoc, type LegalSection } from '../legal-doc';

export const metadata: Metadata = {
  title: 'Privacy Policy — Pharma Ist',
  description: 'How Pharma Ist collects, uses and protects pharmacy and customer data.',
};

const SECTIONS: LegalSection[] = [
  {
    heading: 'Introduction',
    body: [
      'Pharma Ist ("the Service") is a pharmacy management platform operated by Z2INFY Technologies ("we", "us", "our"). This policy explains what information we collect when your pharmacy uses the Service, how we use it, and the choices you have.',
      'This policy applies to pharmacy owners, staff users and the business records they manage in the Service. It does not replace any agreement signed between your pharmacy and Z2INFY Technologies.',
    ],
  },
  {
    heading: 'Information we collect',
    body: [
      'We collect information needed to run your pharmacy on the Service:',
      {
        list: [
          'Account data — your name, email, phone number, role and encrypted password.',
          'Business data you enter — medicines, inventory batches, bills, prescriptions, vendors, customers and reports.',
          'Customer records you choose to store — customer name, contact details and purchase history, which you are responsible for collecting lawfully.',
          'Usage and device data — log entries, IP address, browser type and actions taken, used to secure and improve the Service.',
        ],
      },
    ],
  },
  {
    heading: 'How we use information',
    body: [
      'We use the information we collect to:',
      {
        list: [
          'Provide, maintain and secure the Service for your pharmacy.',
          'Authenticate users and enforce role-based access controls.',
          'Generate the billing, inventory, compliance and analytics features you use.',
          'Diagnose problems, prevent fraud and misuse, and improve the product.',
          'Send service-related notices such as security alerts and billing reminders.',
        ],
      },
      'We do not sell your data, and we do not use the business or customer records you store for advertising.',
    ],
  },
  {
    heading: 'Data ownership',
    body: [
      'The pharmacy data you enter belongs to your pharmacy. We process it on your behalf as a data processor. You remain responsible for the accuracy of that data and for having a lawful basis to collect any personal information about your customers.',
    ],
  },
  {
    heading: 'Data sharing',
    body: [
      'We share information only where necessary to operate the Service:',
      {
        list: [
          'With service providers (such as hosting and communication providers) who process data under contract on our behalf.',
          'When required by law, regulation, or a valid legal request from an authority.',
          'To protect the rights, safety and security of our users and the Service.',
        ],
      },
    ],
  },
  {
    heading: 'Data security',
    body: [
      'We protect your data with encryption in transit, encrypted password storage, role-based access controls and regular backups. No system is perfectly secure, but we take reasonable technical and organisational measures appropriate to the sensitivity of pharmacy records.',
    ],
  },
  {
    heading: 'Data retention',
    body: [
      'We retain your pharmacy data for as long as your account is active. Business and compliance records (such as Schedule registers and billing history) may be retained for the periods required by applicable pharmacy and tax regulations. On account closure, data is deleted or anonymised after a reasonable grace period, subject to those legal retention requirements.',
    ],
  },
  {
    heading: 'Your rights',
    body: [
      'Depending on your jurisdiction, you may have the right to access, correct, export or delete personal data we hold about you. Pharmacy administrators can manage most user and customer records directly within the Service. For other requests, contact us using the details below.',
    ],
  },
  {
    heading: 'Changes to this policy',
    body: [
      'We may update this policy from time to time. When we make material changes, we will update the "Last updated" date above and, where appropriate, notify you within the Service.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      updated="3 October 2026"
      intro="Your pharmacy's data — and your customers' data — is sensitive. This policy explains, in plain language, what we collect and how we handle it."
      sections={SECTIONS}
    />
  );
}
