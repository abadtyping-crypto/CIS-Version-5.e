import { getTenantSettingDoc, incrementTransactionSequence, getTransactionSequence, ensureTransactionSequenceStart } from './backendStore';
import { buildSequenceKey, formatDisplayId, normalizeIdRule } from './idFormat';
export { toSafeDocId } from './idUtils';

/**
 * Generates a display transaction ID based on tenant customization.
 * @param {string} tenantId
 * @param {string} type - 'POR' | 'EXP' | 'LON' | 'LOAN' | 'TRF'
 * @returns {Promise<string>} - The formatted display ID.
 */
export const generateDisplayTxId = async (tenantId, type) => {
    // 1. Fetch tenant customization settings
    const settingsRes = await getTenantSettingDoc(tenantId, 'transactionIdRules');
    const storedRule = settingsRes.ok && settingsRes.data ? settingsRes.data[type] || {} : {};
    const normalizedRule = normalizeIdRule(storedRule, type);

    // 2. Determine sequence key and increment
    const seqKey = buildSequenceKey(`last${type}Seq`, normalizedRule);
    if (normalizedRule.sequenceStart > 0) {
        const current = await getTransactionSequence(tenantId, seqKey);
        if (current < normalizedRule.sequenceStart) {
            await ensureTransactionSequenceStart(tenantId, seqKey, normalizedRule.sequenceStart);
        }
    }
    const seq = await incrementTransactionSequence(tenantId, seqKey);

    // 3. Assemble via one shared formatter
    return formatDisplayId({
        prefix: normalizedRule.prefix,
        seq,
        padding: normalizedRule.padding,
        dateFormat: normalizedRule.dateEnabled ? normalizedRule.dateFormat : 'NONE',
        useSeparator: normalizedRule.useSeparator,
    });
};
