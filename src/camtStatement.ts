/**
 * An electronic account statement handed out as a camt.053 message.
 *
 * The camt sibling of {@link ElectronicStatement}: same document, but structured.
 * Where the PDF route yields bytes that still have to be read back into transactions,
 * this one yields a message this library can parse.
 */
export type CamtStatement = {
	/** The camt schema URN of {@link document}, as announced by the bank */
	camtDescriptor: string;

	/** Start of the period the statement covers */
	from?: Date;

	/** End of the period the statement covers, absent when the bank leaves it open */
	to?: Date;

	/** The date the statement was created by the bank */
	date?: Date;

	/** The year the statement number refers to, statement numbers restart every year */
	year?: number;

	/**
	 * The sequential number of the statement within its year.
	 *
	 * The specification requires this to equal `LglSeqNb` inside the camt.053 message.
	 * Where both are present and disagree, segment and payload do not belong together.
	 */
	number?: number;

	/** The camt.053 message itself */
	document: Uint8Array;

	/** Information about the closing of the accounting period, when the bank provides it */
	closingInfo?: string;

	/** Information about the conditions of the account, when the bank provides it */
	conditionsInfo?: string;

	/** Advertising text, when the bank provides it */
	advertisement?: string;

	iban?: string;
	bic?: string;

	/** The account holder's name, joined from the up to three name lines the bank sends */
	accountName?: string;

	/**
	 * The receipt for this statement. When the bank requires acknowledgement
	 * (`receiptRequired` in the HIECAS parameters), it keeps handing out the statement
	 * until it has been acknowledged with this receipt.
	 */
	receipt?: string;
};
