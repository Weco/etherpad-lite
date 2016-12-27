let subscribers = [];
const find = function(event, handler, strict) {
	const [ name, scope ] = event.split('.');

	return subscribers.filter(subscriber => {
		let isEventMatch = false,
			isHandlerMatch = !handler || handler === subscriber.callback;

		if (strict || (subscriber.name !== '*' && name !== '*')) {
			isEventMatch = scope ? scope === subscriber.scope : name === subscriber.name;
		} else {
			isEventMatch = true;
		}

		return isEventMatch && isHandlerMatch;
	});
}
const postMessage = {
	subscribe: (event, handler) => {
		const id = new Date().getTime().toString(36) + Math.random().toString(36).substr(2, 9);
		const [ name, scope ] = event.split('.');

		subscribers.push({
			id,
			name,
			scope,
			handler
		});

		return () => {
			subscribers = subscribers.filter(subscriber => subscriber.id !== id);
		};
	},
	unsubscribe: (name, handler) => {
		const unsubscribed = find(name, handler, true);

		subscribers = subscribers.filter(subscriber => unsubscribed.indexOf(subscriber) === -1);
	},
	send: (name, data) => find(name).forEach(subscriber => subscriber.handler(data))
}

export default window.top.pm = postMessage;