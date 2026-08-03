import { type CustomerMessage, type CustomerOrderMessage, Message } from './message.js';

export class HttpClient {
	constructor(
		public url: string,
		public debug = false,
		public debugRaw = false,
	) {}

	async sendMessage(message: CustomerMessage): Promise<Message> {
		const encodedMessage = message.encode();
		const requestBuffer = Buffer.from(encodedMessage);

		if (this.debug) {
			console.log('Request Message:\n');

			if (this.debugRaw) {
				console.log(encodedMessage.split("'").join('\n'));
			} else {
				console.log(message.toString());
			}
		}

		const response = await fetch(this.url, {
			method: 'POST',
			headers: { 'Content-Type': 'text/plain' },
			body: requestBuffer.toString('base64'),
		});

		if (response.ok) {
			const rawBody = await response.text();
			const responseBuffer = Buffer.from(rawBody, 'base64');
			const responseText = responseBuffer.toString('latin1');

			// A FinTS response always starts with the HNHBK message head. Anything
			// else (an HTML portal page, a load-balancer error) would base64-decode
			// into garbage and surface as a misleading segment-parser error deep in
			// the decoder. Fail loudly with the facts needed for a diagnosis instead.
			if (!responseText.startsWith('HNHBK')) {
				const contentType = response.headers.get('content-type') ?? 'unknown';
				throw new Error(
					`Bank did not answer with FinTS (content-type ${contentType}, url ${response.url}): ` +
						rawBody.slice(0, 200),
				);
			}

			try {
				const customerOrderMessage = message as CustomerOrderMessage;
				const responseMessage = Message.decode(
					responseText,
					customerOrderMessage.supportsPartedResponseSegments
						? customerOrderMessage.orderResponseSegId
						: undefined,
				);
				if (this.debug) {
					console.log('Response Message:\n');

					if (this.debugRaw) {
						console.log(responseText.split("'").join('\n'));
					} else {
						console.log(`Response Message:\n${responseMessage.toString(true)}\n`);
					}
				}
				return responseMessage;
			} catch (error) {
				console.error('Error decoding response message:', error);
				console.error('Response Message Content:\n', responseText.split("'").join('\n'));
				throw error;
			}
		} else {
			throw Error(`Request failed with status code ${response.status}: ${await response.text()}`);
		}
	}
}
