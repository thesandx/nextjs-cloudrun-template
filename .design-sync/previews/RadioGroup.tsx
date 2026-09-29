import { RadioGroup } from 'nextjs-cloudrun-template';

const ROUND_LENGTHS = [
  { value: 'short', label: 'Short', hint: 'About 5 minutes.' },
  { value: 'standard', label: 'Standard', hint: 'About 10 minutes.' },
  { value: 'marathon', label: 'Marathon', hint: 'Until someone gives up.' },
];

export const Default = () => (
  <RadioGroup
    label="Round length"
    name="round-length"
    options={ROUND_LENGTHS}
    defaultValue="standard"
  />
);

export const WithError = () => (
  <RadioGroup
    label="Round length"
    name="round-length-error"
    options={ROUND_LENGTHS}
    required
    error="Pick a round length to start."
  />
);

export const DisabledOption = () => (
  <RadioGroup
    label="Game"
    name="game"
    defaultValue="bingo"
    options={[
      { value: 'bingo', label: 'Bingo' },
      { value: 'trivia', label: 'Trivia' },
      { value: 'draw', label: 'Draw it', hint: 'Coming later.', disabled: true },
    ]}
  />
);
