import { AlphaNumeric } from '../dataElements/AlphaNumeric.js';
import { Numeric } from '../dataElements/Numeric.js';
import { DataGroup } from '../dataGroups/DataGroup.js';
import {
	type InternationalAccount,
	InternationalAccountGroup,
} from '../dataGroups/InternationalAccount.js';
import type { Segment } from '../segment.js';
import { SegmentDefinition } from '../segmentDefinition.js';

export type HKECASegment = Segment & {
	/** HKECA has no national account variant — the international connection is mandatory */
	account: InternationalAccount;
	/**
	 * The camt schema URNs the client accepts, chosen from the ones the bank announces in
	 * HIECAS. At least one valid camt.053 URN is mandatory.
	 */
	camtFormats: string[];
	/** The sequential number of the statement to fetch, only allowed when the bank sets `indexAllowed` */
	statementNumber?: number;
	/** The year the statement number refers to; empty means the current calendar year */
	statementYear?: number;
	maxEntries?: number;
	/**
	 * The offset ("Aufsetzpunkt") the bank returned with answer code 3040, to fetch the
	 * next statement.
	 *
	 * Deliberately NOT named `continuationMark`, for the same reason as in HKEKA: the bank
	 * is not splitting one oversized response here, it announces that a *further document*
	 * is waiting. The generic parted-message handling would splice two complete HIECA
	 * segments into one corrupt segment.
	 */
	offset?: string;
};

/**
 * Request an electronic account statement as camt.053 (Kontoauszug camt anfordern)
 *
 * FinTS 3.0, Messages – Geschäftsvorfälle, C.2.3.1.2.1.
 *
 * THE DIFFERENCE TO HKEKA IS NOT COSMETIC. HKEKA hands out the statement *document* —
 * for most banks a PDF that has to be parsed back into transactions. HKECA hands out a
 * camt.053 message: the same statement, but structured. Where the PDF route needs a
 * layout parser and a self-check to prove it read every line, the camt route is read by
 * the parser this library already has.
 *
 * Two structural differences follow from the specification and are easy to get wrong:
 *
 * - Element 2 is the INTERNATIONAL account connection only. HKEKA still carries a
 *   national variant for versions up to 3; HKECA exists only in version 1 and has none.
 * - Element 3 is a data GROUP with a repeating descriptor, not a single format code.
 *   HKEKA sends `statementFormat` as one code ('1' MT940, '2' ISO8583, '3' PDF); HKECA
 *   sends up to 99 camt schema URNs, and they must be chosen from what the bank
 *   announced in HIECAS. Sending a URN the bank did not offer is rejected.
 */
export class HKECA extends SegmentDefinition {
	static Id = 'HKECA';
	static Version = 1;
	constructor() {
		super(HKECA.Id);
	}
	version = HKECA.Version;
	elements = [
		new InternationalAccountGroup('account', 1, 1),
		new DataGroup('camtFormats', [new AlphaNumeric('descriptor', 1, 99, 256)], 1, 1),
		new Numeric('statementNumber', 0, 1, 5),
		new Numeric('statementYear', 0, 1, 4),
		new Numeric('maxEntries', 0, 1, 4),
		new AlphaNumeric('offset', 0, 1, 35),
	];
}
