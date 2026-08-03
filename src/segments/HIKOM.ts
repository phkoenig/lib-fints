import type { Language } from '../codes.js';
import { AlphaNumeric } from '../dataElements/AlphaNumeric.js';
import { Numeric } from '../dataElements/Numeric.js';
import type { Bank } from '../dataGroups/Account.js';
import { BankIdentification } from '../dataGroups/BankIdentification.js';
import { DataGroup } from '../dataGroups/DataGroup.js';
import type { Segment } from '../segment.js';
import { SegmentDefinition } from '../segmentDefinition.js';

export type HIKOMSegment = Segment & {
	bankIdentification: Bank;
	defaultLanguage: Language;
	/**
	 * Repeats once per offered communication access (FinTS 3.0 Formals: 1..9).
	 * HVB sends TWO entries — service 2 first, the HTTPS one (service 3) second.
	 * With maxCount 1 only the first survived decoding, and the client then
	 * happily talked to a web portal instead of the FinTS endpoint.
	 */
	comParams: ComParams[];
};

export type ComParams = {
	service: number;
	address: string;
	addressExt?: string;
	filter?: string;
	filterVer?: string;
};

/**
 *
 */
export class HIKOM extends SegmentDefinition {
	static Id = 'HIKOM';
	version = 4;
	constructor() {
		super(HIKOM.Id);
	}
	elements = [
		new BankIdentification('bank', 1, 1),
		new Numeric('defLang', 1, 1, 3),
		new DataGroup(
			'comParams',
			[
				new Numeric('service', 1, 1, 2),
				new AlphaNumeric('address', 1, 1, 512),
				new AlphaNumeric('addressExt', 0, 1, 512),
				new AlphaNumeric('filter', 0, 1, 3),
				new Numeric('filterVer', 0, 1, 3),
			],
			1,
			9,
		),
	];
}
