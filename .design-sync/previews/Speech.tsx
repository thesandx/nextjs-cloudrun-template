import { Speech } from 'nextjs-cloudrun-template';

export const Happy = () => <Speech>momo joined. That makes five of you.</Speech>;

export const Sad = () => <Speech mood="sad">This key has expired. Ask the host for a fresh one.</Speech>;

export const Wow = () => <Speech mood="wow">Two lines in one round? That is a record.</Speech>;
