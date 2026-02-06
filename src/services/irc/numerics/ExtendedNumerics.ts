/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Extended Numeric Handlers (609-629, 660-689, 700-772, 910-999)
 *
 * These are server-specific and extended numerics that typically just display messages.
 * Each numeric has a specific handler but most follow a simple pattern.
 */

import { tx } from '../../../i18n/transifex';
import type { NumericHandlerContext, NumericHandler } from '../types';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

/** Generic handler for simple extended numerics */
const createExtendedHandler = (numeric: number, defaultMsg: string = ''): NumericHandler => {
  return (ctx, prefix, params, timestamp) => {
    const message = params.slice(1).join(' ').replace(/^:/, '') || t(defaultMsg);
    ctx.addMessage({
      type: 'raw',
      text: t('*** [{numeric}] {message}', { numeric, message }),
      timestamp,
      isRaw: true,
      rawCategory: 'server',
    });
  };
};

/** Generic error handler for extended numerics */
const createExtendedErrorHandler = (numeric: number, defaultMsg: string = ''): NumericHandler => {
  return (ctx, prefix, params, timestamp) => {
    const message = params.slice(1).join(' ').replace(/^:/, '') || t(defaultMsg);
    ctx.addMessage({
      type: 'error',
      text: t('[{numeric}] {message}', { numeric, message }),
      timestamp,
    });
  };
};

// ========================================
// 609-629 Extended Services Numerics
// ========================================

/** 609 RPL_WATCHNICKCHANGE - Someone on WATCH changed nick */
export const handle609: NumericHandler = (ctx, prefix, params, timestamp) => {
  const oldNick = params[1] || '';
  const newNick = params[2] || '';
  const watchUser = params[3] || '';
  const watchHost = params[4] || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {oldNick} changed nick to {newNick} ({user}@{host})', {
      oldNick,
      newNick,
      user: watchUser,
      host: watchHost,
    }),
    timestamp,
    isRaw: true,
    rawCategory: 'user',
  });
};

/** 610 RPL_WHOWAS_TIME - WHOWAS time info */
export const handle610: NumericHandler = (ctx, prefix, params, timestamp) => {
  const nick = params[1] || '';
  const timeInfo = params.slice(2).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** WHOWAS {nick}: {info}', { nick, info: timeInfo }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 611-629 Extended services numerics */
export const handle611: NumericHandler = createExtendedHandler(611);
export const handle612: NumericHandler = createExtendedHandler(612);
export const handle613: NumericHandler = createExtendedHandler(613);
export const handle614: NumericHandler = createExtendedHandler(614);
export const handle615: NumericHandler = createExtendedHandler(615);
export const handle616: NumericHandler = createExtendedHandler(616);
export const handle617: NumericHandler = createExtendedHandler(617);
export const handle618: NumericHandler = createExtendedHandler(618);

/** 619 RPL_ENDOFWHOWAS (extended) */
export const handle619: NumericHandler = (ctx, prefix, params, timestamp) => {
  const nick = params[1] || '';
  const message = params.slice(2).join(' ').replace(/^:/, '') || t('End of WHOWAS');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick}: {message}', { nick, message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

export const handle620: NumericHandler = createExtendedHandler(620);
export const handle621: NumericHandler = createExtendedHandler(621);
export const handle622: NumericHandler = createExtendedHandler(622);
export const handle623: NumericHandler = createExtendedHandler(623);
export const handle624: NumericHandler = createExtendedHandler(624);
export const handle625: NumericHandler = createExtendedHandler(625);
export const handle626: NumericHandler = createExtendedHandler(626);
export const handle627: NumericHandler = createExtendedHandler(627);
export const handle628: NumericHandler = createExtendedHandler(628);
export const handle629: NumericHandler = createExtendedHandler(629);

// ========================================
// 660-689 Extended Numerics
// ========================================

/** 660 RPL_LOGON (extended) */
export const handle660: NumericHandler = (ctx, prefix, params, timestamp) => {
  const nick = params[1] || '';
  const message = params.slice(2).join(' ').replace(/^:/, '') || t('is now online');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick} {message}', { nick, message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

/** 661 RPL_LOGOFF (extended) */
export const handle661: NumericHandler = (ctx, prefix, params, timestamp) => {
  const nick = params[1] || '';
  const message = params.slice(2).join(' ').replace(/^:/, '') || t('is now offline');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {nick} {message}', { nick, message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

export const handle662: NumericHandler = createExtendedHandler(662);
export const handle663: NumericHandler = createExtendedHandler(663);
export const handle664: NumericHandler = createExtendedHandler(664);
export const handle665: NumericHandler = createExtendedHandler(665);
export const handle666: NumericHandler = createExtendedHandler(666);
/** 667 ERR_TARGCHANGE - Target change too fast */
export const handle667: NumericHandler = createExtendedErrorHandler(667, 'Target change too fast');
export const handle668: NumericHandler = createExtendedHandler(668);
export const handle669: NumericHandler = createExtendedHandler(669);
export const handle672: NumericHandler = createExtendedHandler(672);
export const handle673: NumericHandler = createExtendedHandler(673);
/** 674 ERR_CANNOTSETMODES - Cannot set modes */
export const handle674: NumericHandler = createExtendedErrorHandler(674, 'Cannot set modes');
export const handle675: NumericHandler = createExtendedHandler(675);
export const handle676: NumericHandler = createExtendedHandler(676);
export const handle678: NumericHandler = createExtendedHandler(678);
export const handle679: NumericHandler = createExtendedHandler(679);
export const handle680: NumericHandler = createExtendedHandler(680);
export const handle681: NumericHandler = createExtendedHandler(681);
export const handle682: NumericHandler = createExtendedHandler(682);
export const handle687: NumericHandler = createExtendedHandler(687);
export const handle688: NumericHandler = createExtendedHandler(688);
export const handle689: NumericHandler = createExtendedHandler(689);

// ========================================
// 700-772 Extended Numerics
// ========================================

export const handle700: NumericHandler = createExtendedHandler(700);
export const handle701: NumericHandler = createExtendedHandler(701);
export const handle702: NumericHandler = createExtendedHandler(702);
export const handle703: NumericHandler = createExtendedHandler(703);
export const handle704: NumericHandler = createExtendedHandler(704);
export const handle705: NumericHandler = createExtendedHandler(705);
export const handle706: NumericHandler = createExtendedHandler(706);
export const handle707: NumericHandler = createExtendedHandler(707);
export const handle708: NumericHandler = createExtendedHandler(708);
export const handle709: NumericHandler = createExtendedHandler(709);

/** 710 RPL_KNOCK - Knock notification */
export const handle710: NumericHandler = (ctx, prefix, params, timestamp) => {
  const channel = params[1] || '';
  const message = params.slice(2).join(' ').replace(/^:/, '') || t('has knocked');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {channel}: {message}', { channel, message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

export const handle711: NumericHandler = createExtendedHandler(711);

/** 712 ERR_TOOMANYKNOCK - Too many knocks */
export const handle712: NumericHandler = createExtendedErrorHandler(712, 'Too many knocks');

/** 713 ERR_CHANOPEN - Channel is open (no knocks) */
export const handle713: NumericHandler = createExtendedErrorHandler(713, 'Channel is open');

/** 714 ERR_KNOCKONCHAN - You are already on the channel */
export const handle714: NumericHandler = createExtendedErrorHandler(714, 'You are on that channel');

/** 715 ERR_KNOCKDISABLED - Knock is disabled */
export const handle715: NumericHandler = createExtendedErrorHandler(715, 'Knock is disabled');

export const handle716: NumericHandler = createExtendedHandler(716);
export const handle717: NumericHandler = createExtendedHandler(717);
export const handle718: NumericHandler = createExtendedHandler(718);

/** 720 RPL_OMOTDSTART - Operator MOTD start */
export const handle720: NumericHandler = (ctx, prefix, params, timestamp) => {
  const message = params.slice(1).join(' ').replace(/^:/, '') || t('Operator MOTD');
  ctx.addMessage({
    type: 'raw',
    text: t('*** {message}', { message }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

export const handle721: NumericHandler = createExtendedHandler(721);
export const handle722: NumericHandler = createExtendedHandler(722);

/** 723 ERR_NOPRIVS - Insufficient privileges */
export const handle723: NumericHandler = createExtendedErrorHandler(723, 'Insufficient privileges');

export const handle724: NumericHandler = createExtendedHandler(724);
export const handle725: NumericHandler = createExtendedHandler(725);
export const handle726: NumericHandler = createExtendedHandler(726);
export const handle727: NumericHandler = createExtendedHandler(727);
export const handle728: NumericHandler = createExtendedHandler(728);

/** 729 RPL_CHANNELMODEIS (extended) */
export const handle729: NumericHandler = (ctx, prefix, params, timestamp) => {
  const channel = params[1] || '';
  const modes = params.slice(2).join(' ').replace(/^:/, '') || '';
  ctx.addMessage({
    type: 'raw',
    text: t('*** {channel} modes: {modes}', { channel, modes }),
    timestamp,
    isRaw: true,
    rawCategory: 'server',
  });
};

export const handle740: NumericHandler = createExtendedHandler(740);
export const handle741: NumericHandler = createExtendedHandler(741);

/** 742 ERR_MLOCKRESTRICTED - Mode lock restricted */
export const handle742: NumericHandler = createExtendedErrorHandler(742, 'Mode lock restricted');

/** 743 ERR_INVALIDBAN - Invalid ban mask */
export const handle743: NumericHandler = createExtendedErrorHandler(743, 'Invalid ban mask');

/** 744 ERR_TOPICLOCK - Topic is locked */
export const handle744: NumericHandler = createExtendedErrorHandler(744, 'Topic is locked');

export const handle750: NumericHandler = createExtendedHandler(750);
export const handle751: NumericHandler = createExtendedHandler(751);
export const handle752: NumericHandler = createExtendedHandler(752);
export const handle759: NumericHandler = createExtendedHandler(759);
export const handle760: NumericHandler = createExtendedHandler(760);
export const handle761: NumericHandler = createExtendedHandler(761);
export const handle762: NumericHandler = createExtendedHandler(762);

/** 764 ERR_METADATALIMIT - Metadata limit reached */
export const handle764: NumericHandler = createExtendedErrorHandler(764, 'Metadata limit reached');

/** 765 ERR_TARGETINVALID - Invalid target */
export const handle765: NumericHandler = createExtendedErrorHandler(765, 'Invalid target');

/** 766 ERR_NOMATCHINGKEY - No matching key */
export const handle766: NumericHandler = createExtendedErrorHandler(766, 'No matching key');

/** 767 ERR_KEYINVALID - Invalid key */
export const handle767: NumericHandler = createExtendedErrorHandler(767, 'Invalid key');

/** 768 ERR_KEYNOTSET - Key not set */
export const handle768: NumericHandler = createExtendedErrorHandler(768, 'Key not set');

/** 769 ERR_KEYNOPERMISSION - No permission for key */
export const handle769: NumericHandler = createExtendedErrorHandler(769, 'No permission for key');

export const handle770: NumericHandler = createExtendedHandler(770);
export const handle771: NumericHandler = createExtendedHandler(771);
export const handle772: NumericHandler = createExtendedHandler(772);

// ========================================
// 910-999 SASL/Auth Extension Numerics
// ========================================

export const handle910: NumericHandler = createExtendedHandler(910);
export const handle911: NumericHandler = createExtendedHandler(911);
export const handle912: NumericHandler = createExtendedHandler(912);
export const handle913: NumericHandler = createExtendedHandler(913);
export const handle914: NumericHandler = createExtendedHandler(914);

/** 915 ERR_ACCESSDENIED - Access denied */
export const handle915: NumericHandler = createExtendedErrorHandler(915, 'Access denied');

export const handle920: NumericHandler = createExtendedHandler(920);
export const handle921: NumericHandler = createExtendedHandler(921);
export const handle922: NumericHandler = createExtendedHandler(922);
export const handle923: NumericHandler = createExtendedHandler(923);

/** 936 ERR_CENSORED - Text is censored */
export const handle936: NumericHandler = createExtendedErrorHandler(936, 'Text is censored');

export const handle940: NumericHandler = createExtendedHandler(940);
export const handle941: NumericHandler = createExtendedHandler(941);
export const handle942: NumericHandler = createExtendedHandler(942);

/** 972 ERR_CANNOTDOCOMMAND - Cannot do command */
export const handle972: NumericHandler = createExtendedErrorHandler(972, 'Cannot execute command');

/** 973 ERR_CANNOTCHANGENICK - Cannot change nick */
export const handle973: NumericHandler = createExtendedErrorHandler(973, 'Cannot change nickname');

/** 974 ERR_CANNOTDEOP - Cannot deop */
export const handle974: NumericHandler = createExtendedErrorHandler(974, 'Cannot deop');

/** 975 ERR_ISREALSERVICE - Is a real service */
export const handle975: NumericHandler = createExtendedErrorHandler(975, 'Is a real service');

export const handle998: NumericHandler = createExtendedHandler(998);
export const handle999: NumericHandler = createExtendedHandler(999);

/**
 * Extended numerics handlers map
 */
export const extendedHandlers: Map<number, NumericHandler> = new Map([
  // 609-629
  [609, handle609],
  [610, handle610],
  [611, handle611],
  [612, handle612],
  [613, handle613],
  [614, handle614],
  [615, handle615],
  [616, handle616],
  [617, handle617],
  [618, handle618],
  [619, handle619],
  [620, handle620],
  [621, handle621],
  [622, handle622],
  [623, handle623],
  [624, handle624],
  [625, handle625],
  [626, handle626],
  [627, handle627],
  [628, handle628],
  [629, handle629],
  // 660-689
  [660, handle660],
  [661, handle661],
  [662, handle662],
  [663, handle663],
  [664, handle664],
  [665, handle665],
  [666, handle666],
  [667, handle667],
  [668, handle668],
  [669, handle669],
  [672, handle672],
  [673, handle673],
  [674, handle674],
  [675, handle675],
  [676, handle676],
  [678, handle678],
  [679, handle679],
  [680, handle680],
  [681, handle681],
  [682, handle682],
  [687, handle687],
  [688, handle688],
  [689, handle689],
  // 700-772
  [700, handle700],
  [701, handle701],
  [702, handle702],
  [703, handle703],
  [704, handle704],
  [705, handle705],
  [706, handle706],
  [707, handle707],
  [708, handle708],
  [709, handle709],
  [710, handle710],
  [711, handle711],
  [712, handle712],
  [713, handle713],
  [714, handle714],
  [715, handle715],
  [716, handle716],
  [717, handle717],
  [718, handle718],
  [720, handle720],
  [721, handle721],
  [722, handle722],
  [723, handle723],
  [724, handle724],
  [725, handle725],
  [726, handle726],
  [727, handle727],
  [728, handle728],
  [729, handle729],
  [740, handle740],
  [741, handle741],
  [742, handle742],
  [743, handle743],
  [744, handle744],
  [750, handle750],
  [751, handle751],
  [752, handle752],
  [759, handle759],
  [760, handle760],
  [761, handle761],
  [762, handle762],
  [764, handle764],
  [765, handle765],
  [766, handle766],
  [767, handle767],
  [768, handle768],
  [769, handle769],
  [770, handle770],
  [771, handle771],
  [772, handle772],
  // 910-999
  [910, handle910],
  [911, handle911],
  [912, handle912],
  [913, handle913],
  [914, handle914],
  [915, handle915],
  [920, handle920],
  [921, handle921],
  [922, handle922],
  [923, handle923],
  [936, handle936],
  [940, handle940],
  [941, handle941],
  [942, handle942],
  [972, handle972],
  [973, handle973],
  [974, handle974],
  [975, handle975],
  [998, handle998],
  [999, handle999],
]);
