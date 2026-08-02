import { AlphaNumeric } from '../dataElements/AlphaNumeric.js';
import { Binary } from '../dataElements/Binary.js';
import { Dat } from '../dataElements/Dat.js';
import { Numeric } from '../dataElements/Numeric.js';
import { DataGroup } from '../dataGroups/DataGroup.js';
import type { Segment } from '../segment.js';
import { SegmentDefinition } from '../segmentDefinition.js';

export type HIECASegment = Segment & {
	/** The camt schema URN of the message in `booked` */
	camtDescriptor: string;
	timeRange?: { from?: Date; to?: Date };
	date?: Date;
	year?: number;
	number?: number;
	/** The camt.053 message itself */
	booked: string;
	closingInfo?: string;
	conditionsInfo?: string;
	advertisement?: string;
	iban?: string;
	bic?: string;
	name?: string;
	name2?: string;
	name3?: string;
	/** Receipt to acknowledge the statement with, when the bank requires acknowledgement */
	receipt?: string;
};

/**
 * Electronic account statement response as camt.053 (Kontoauszug camt)
 *
 * FinTS 3.0, Messages – Geschäftsvorfälle, C.2.3.1.2.1.
 *
 * The element order is taken from the specification and NOT carried over from HIEKA.
 * They look alike and differ in the first two elements: HIEKA starts with a single
 * format code, HIECA with the camt descriptor (an ..25) — and its time range is
 * version 2 of the Berichtszeitraum data group, where only the start date is
 * mandatory. Reusing HIEKA's layout would not fail loudly; it would shift every
 * following field by one and hand out the wrong bytes as the document.
 *
 * `number` must match `LglSeqNb` inside the camt.053 message — the specification says so
 * explicitly, which makes it a free self-check: if the two disagree, the segment and its
 * payload do not belong together.
 */
export class HIECA extends SegmentDefinition {
	static Id = 'HIECA';
	static Version = 1;
	constructor() {
		super(HIECA.Id);
	}
	version = HIECA.Version;
	elements = [
		new AlphaNumeric('camtDescriptor', 1, 1, 25),
		new DataGroup('timeRange', [new Dat('from', 1, 1), new Dat('to', 0, 1)], 1, 1),
		new Dat('date', 0, 1),
		new Numeric('year', 0, 1, 4),
		new Numeric('number', 0, 1, 5),
		new Binary('booked', 1, 1),
		new AlphaNumeric('closingInfo', 0, 1, 65536),
		new AlphaNumeric('conditionsInfo', 0, 1, 65536),
		new AlphaNumeric('advertisement', 0, 1, 65536),
		new AlphaNumeric('iban', 0, 1, 34),
		new AlphaNumeric('bic', 0, 1, 11),
		new AlphaNumeric('name', 0, 1, 35),
		new AlphaNumeric('name2', 0, 1, 35),
		new AlphaNumeric('name3', 0, 1, 35),
		new Binary('receipt', 0, 1),
	];
}
