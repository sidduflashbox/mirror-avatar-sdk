// Design tokens for the avatar UI. Where a value approximates a CSS feature React Native
// lacks (blur, radial gradients), the comment says so.

export const STAGE_BG = '#07070f';

/** The avatar occupies a band, not the whole screen. `top: 12vh; height: 52vh`. */
export const AVATAR_BAND_TOP = '12%';
export const AVATAR_BAND_HEIGHT = '52%';
/** `opacity: ended ? 0.45 : 1`, 700ms. */
export const AVATAR_ENDED_OPACITY = 0.45;

/** `linear-gradient(to bottom, transparent, #07070f 80%)`, height 200, bottom -48. */
export const FADE_HEIGHT = 200;
export const FADE_OFFSET = -48;

/** Ambient glow: `radial-gradient(ellipse 80% 70% at 50% 35%)` under `blur(80px)`. */
export const GLOW_ERROR = 'rgba(220,50,50,0.04)';
export const GLOW_SPEAKING = 'rgba(246,128,72,0.05)';
export const GLOW_LIVE = 'rgba(40,69,214,0.06)';
export const GLOW_IDLE = 'rgba(255,255,255,0.02)';
export const GLOW_FADE_MS = 1000;
export const GLOW_BLUR_PX = 80;

/** Pill chrome — the badge and the timer share it. */
export const PILL_BG = 'rgba(255,255,255,0.06)';
export const PILL_BORDER = 'rgba(255,255,255,0.08)';

export const BADGE_COLOR = 'rgba(255,255,255,0.40)';
export const BADGE_FONT_SIZE = 11;
export const BADGE_LETTER_SPACING = 0.8; // `tracking-wide` at 11px

export const TIMER_COLOR = 'rgba(255,255,255,0.75)';
export const TIMER_FONT_SIZE = 12;
export const TIMER_ICON_COLOR = 'rgba(255,255,255,0.50)';

export const CAPTION_COLOR = 'rgba(255,255,255,0.85)';
export const CAPTION_FONT_SIZE = 15;
export const CAPTION_MAX_WIDTH = 448; // `max-w-md`

export const ERROR_COLOR = 'rgba(248,113,113,0.7)';
export const ERROR_FONT_SIZE = 12;
export const ERROR_BOTTOM = 112;

/** Controls. 56×56 round mute; red end-call pill. */
export const CONTROL_SIZE = 56;
export const CONTROL_GAP = 24;
export const CONTROL_LABEL_COLOR = 'rgba(255,255,255,0.45)';
export const CONTROL_LABEL_SIZE = 11;
export const MUTE_BG = 'rgba(255,255,255,0.10)';
export const MUTE_BORDER = 'rgba(255,255,255,0.15)';
// Tailwind v4's `red-500` is `oklch(0.637 0.237 25.331)` — a brighter, more saturated red
// than v3's #EF4444. The End pill and the muted-mic button use the v4 sRGB value.
export const MUTE_ACTIVE_BG = '#FB2C36'; // Tailwind v4 red-500, while muted
export const END_BG = '#FB2C36'; // Tailwind v4 red-500
export const END_PADDING_H = 32;
/** lucide renders at 24px (`h-6 w-6`). */
export const ICON_SIZE = 24;

/** Mic waveform equalizer. */
export const WAVE_H = 46;
export const WAVE_MAX_WIDTH = 220;
export const WAVE_BAR_SLOT = 7; // ~7px per bar slot
export const WAVE_BAR_MAX_W = 3.5;
export const WAVE_MUTED_OPACITY = 0.1;
export const WAVE_TOP_COLOR = 'rgba(150,210,255,0.95)';
export const WAVE_BASE_COLOR = 'rgba(0,136,255,0.55)';
/** Bright light-blue top → brand blue base, per bar. */
export const WAVE_BAR_GRADIENT = `linear-gradient(to bottom, ${WAVE_TOP_COLOR}, ${WAVE_BASE_COLOR})`;
export const WAVE_BAR_GLOW = '0 0 4px rgba(0,136,255,0.35)';

/** Entrance fade. */
export const ENTER_MS = 300;
export const ENTER_CONTROLS_MS = 600;
export const ENTER_CONTROLS_DELAY_MS = 200;

/** Reconnecting veil + end summary. */
export const VEIL_BG = 'rgba(0,0,0,0.6)';
export const VEIL_CARD_BG = '#111120';
export const VEIL_CARD_WIDTH = 288;

/** End-of-call summary panel — a frosted `bg-black/40` card. React Native has no
 *  backdrop-blur, so the card leans a touch more opaque to stay legible over the moving avatar. */
export const SUMMARY_BG = 'rgba(0,0,0,0.4)';
export const SUMMARY_BORDER = 'rgba(255,255,255,0.08)';
export const SUMMARY_TITLE_COLOR = 'rgba(255,255,255,0.85)'; // text-white/85
export const SUMMARY_TIME_COLOR = '#FFFFFF';
export const SUMMARY_CLOCK_COLOR = 'rgba(255,255,255,0.55)'; // text-white/55
export const SUMMARY_LABEL_COLOR = 'rgba(255,255,255,0.45)'; // text-white/45
export const SUMMARY_AGENT_COLOR = 'rgba(255,255,255,0.35)'; // text-white/35
/** Primary "View session details" pill — `linear-gradient(135deg, #0088ff, #38a5ff)`. */
export const SUMMARY_ACCENT_GRADIENT = 'linear-gradient(135deg, #0088ff, #38a5ff)';
export const SUMMARY_ACCENT_GLOW = 'rgba(0,136,255,0.3)';
/** Secondary "Back to agents" pill — `border-white/15 bg-white/[0.06]`. */
export const SUMMARY_SECONDARY_BG = 'rgba(255,255,255,0.06)';
export const SUMMARY_SECONDARY_BORDER = 'rgba(255,255,255,0.15)';
export const SUMMARY_SECONDARY_TEXT = 'rgba(255,255,255,0.75)'; // text-white/75
