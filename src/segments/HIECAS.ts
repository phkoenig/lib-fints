import { AlphaNumeric } from '../dataElements/AlphaNumeric.js';
import { YesNo } from '../dataElements/YesNo.js';
import {
	BusinessTransactionParameter,
	type BusinessTransactionParameterSegment,
} from './businessTransactionParameter.js';

export type HIECASSegment = BusinessTransactionParameterSegment<HIECASParameter>;

export type HIECASParameter = {
	/** Whether a specific statement may be requested by number and year */
	indexAllowed: boolean;
	/**
	 * Whether the bank expects each fetched statement to be acknowledged with its receipt.
	 *
	 * When this is true, NOT acknowledging is safe: the bank keeps offering the statement
	 * until it has been receipted. That is what makes a dry run possible at all — fetching
	 * consumes nothing as long as no receipt is sent.
	 */
	receiptRequired: boolean;
	/** Whether the number of entries may be limited */
	maxEntryCountAllowed: boolean;
	/**
	 * The camt schema URNs the bank supports. A request must pick from these; sending a
	 * URN the bank did not announce is rejected.
	 */
	supportedCamtFormats: string[];
};

/**
 * Parameters for the HKECA business transaction (electronic account statements as camt)
 *
 * FinTS 3.0 Data Dictionary, "Parameter Kontoauszug camt" (DEG version 1).
 *
 * Note the difference to HIEKAS: its fourth element is a one-character format CODE
 * ('1' MT940, '2' ISO8583, '3' PDF), here it is a list of camt schema URNs up to 256
 * characters each. Both are declared "..9" resp. "..99" occurrences, so a decoder that
 * only looks at the cardinality reads both the same way and truncates every URN to a
 * single character.
 */
export class HIECAS extends BusinessTransactionParameter {
	static Id = 'HIECAS';
	version = 1;

	constructor() {
		super(HIECAS.Id, [
			new YesNo('indexAllowed', 1, 1),
			new YesNo('receiptRequired', 1, 1),
			new YesNo('maxEntryCountAllowed', 1, 1),
			new AlphaNumeric('supportedCamtFormats', 1, 99, 256),
		]);
	}
}
