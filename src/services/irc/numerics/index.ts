/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Numeric Handlers Index
 * Re-exports all numeric handler modules
 */

export * from './RegistrationNumerics';
export * from './TraceNumerics';
export * from './LusersNumerics';
export * from './MotdNumerics';
export * from './StatsNumerics';
export * from './ChannelNumerics';
export * from './WhoisNumerics';
export * from './ErrorNumerics';
export * from './VersionInfoNumerics';
export * from './MonitorNumerics';
export * from './StarttlsNumerics';
export * from './SaslNumerics';
export * from './ExtendedNumerics';
export * from './MiscNumerics';
export * from './StatefulChannelNumerics';

// TODO: Export more handlers as they are extracted:
// export * from './SaslNumerics';
// export * from './MonitorNumerics';
// export * from './ExtendedNumerics';
