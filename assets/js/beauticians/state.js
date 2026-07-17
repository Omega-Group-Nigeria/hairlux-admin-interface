/**
 * beauticians/state.js — central page state for Beauticians admin page
 */
(function (global) {
    'use strict';

    var BP = (global.BeauticiansPage = global.BeauticiansPage || {});

    BP.State = {
        VALID_SECTIONS: ['list', 'reviews', 'services', 'service-rates', 'settings', 'payouts'],

        activeSection: 'list',

        list: {
            page: 1,
            limit: 20,
            search: '',
            kycStatus: '',
            profileStatus: '',
            availabilityStatus: '',
            ratingMin: '',
            totalPages: 1,
        },

        reviews: {
            page: 1,
            limit: 20,
            submittedDaysAgoMin: '',
            totalPages: 1,
        },

        payouts: {
            status: '',
        },

        beauticianOptionsLoaded: false,
        svcBeauticianOptionsLoading: false,
        svcBeauticianRows: [],

        /** Per-service commission overrides (Service Rates tab) */
        scr: {
            overrides: [],
            catalogServices: null,
            catalogLoaded: false,
            catalogLoading: false,
            catalogLoadPromise: null,
            platformDefaultRate: null,
            editServicePrice: null,
        },

        SETTINGS_FIELD_HINTS: {
            commissionRate: 'Default beautician take-home share for home-service lines that do not have a per-service override. Applies to all beauticians.',
            payoutMode: 'MANUAL = admin marks bank transfers complete in the dashboard. AUTO = the system can initiate payouts when eligible.',
            dailyPayoutLimit: 'Maximum total beautician withdrawals (NGN) per calendar day (Africa/Lagos midnight). Applies to manual and auto payout modes. Counts PENDING, PROCESSING, and COMPLETED.',
            dailyPayoutUnlimited: 'When on, dailyPayoutLimit is cleared (null) and there is no platform-wide daily cap on payouts.',
            arrivalVerificationExpiryMinutes: 'How long the customer\u2019s arrival OTP/code stays valid after the beautician marks \u201carrived\u201d.',
            serviceCompletionBufferMinutes: 'Grace period after the scheduled end time before the job is treated as overdue for completion rules.',
            arrivalGeoFenceMeters: 'How close the beautician must be to the customer address (in meters) to pass arrival verification.',
            noShowSuspendThreshold: 'How many no-shows trigger a suspension. If a beautician hits that count within the window (default 3 in 30 days), their account is auto-suspended (isActive = false).',
            noShowWindowDays: 'How long we keep counting. Each no-show is tracked in a rolling window (default 30 days). After that period, the count resets.',
            kycAutoApprove: 'When on, a successful QoreID result sets the beautician to VERIFIED immediately. When off, they go to NEEDS_REVIEW until an admin approves KYC.',
            noShowPenaltyEnabled: 'When on, no-shows count toward the suspend threshold. When off, no-show tracking penalties are skipped.',
            tier1Radius: 'Smallest search area (nearest beauticians). Default 5 km. Must be a whole number.',
            tier1OfferTtl: 'Seconds the beautician has to accept a tier-1 offer before it expires. Default 45s. Integer 10\u2013300.',
            tier2Radius: 'Wider search if tier 1 finds no accept. Default 12 km.',
            tier2OfferTtl: 'Offer timeout for tier 2. Default 60s.',
            tier3Radius: 'Widest search before matching is exhausted. Default 25 km.',
            tier3OfferTtl: 'Offer timeout for tier 3. Default 75s.',
            interTierDelaySeconds: 'Wait time after a tier is exhausted before starting the next wider tier. Default 15s. Replaces the old global job offer timeout for escalation.',
            locationStalenessMinutes: 'Beauticians whose last GPS ping is older than this are not offered jobs. Default 5 min.',
            locationRematchMinDistanceM: 'Minimum distance a beautician must move while online before the system re-scans nearby pending bookings. Default 500 m.',
            wakeExhaustedOnOnlineEnabled: 'When on, if a beautician comes online (or moves enough) near an exhausted booking, the system auto-retries matching once per booking.',
            scoringWeightDistance: 'Weight (not a percentage), default 1. Higher values prefer closer beauticians more strongly in ranking.',
            scoringWeightRating: 'Weight, default 0.3. Higher values prefer higher-rated beauticians more.',
            scoringWeightAcceptance: 'Weight for historical job acceptance, default 0.2. This is a ranking multiplier, not an acceptance percentage. Read-only until the API supports writes.',
            scoringWeightIdle: 'Weight, default 0.1. Higher values favour beauticians who have been waiting longer for a job. Read-only until the API supports writes.',
            envOverrides: 'When active, environment variables override tier radius and/or offer TTL. Tier fields may not affect production until those env vars are removed.',
        },

        SETTINGS_HINT_ICON: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01"/><path d="M11 12h1v4h1"/></svg>',
    };
})(window);
