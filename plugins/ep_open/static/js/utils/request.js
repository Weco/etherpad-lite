import window from 'global';
import fetch from 'isomorphic-fetch';
import tree from '../store';

function userSyncPromise() {
	return new Promise(resolve => {
		if (tree.get('userSync')) {
			resolve();
		} else {
			tree.select('userSync').on('update', event => event.data.currentData && resolve());
		}
	});
}

function request(url, params = {}) {
	const isExternal = url.indexOf('http') !== -1;
	const token = tree.select('token').get();

	url = (isExternal ? '' : '/api') + url;
	params.headers = {};
	params.credentials = 'same-origin';

	if (token && token.id) {
		params.headers['X-AUTH-TOKEN'] = token.id;
	}

	if (typeof params.data === 'object') {
		if (/^POST|PUT$/.test(params.method)) {
			params.headers['Content-Type'] = 'application/json';
			params.body = JSON.stringify(params.data);
		} else {
			url += '?' + Object.keys(params.data).map(key => {
				let value = params.data[key];

				if (typeof value === 'object') {
					// If it's array then process data to query string in this way:
					// arrayKey[]=arrayValue1&arrayKey[]=arrayValue2&arrayKey[]=arrayValue3
					if (!!value.length) {
						key += '[]';

						return value.map(valueItem => {
							return key + '=' + valueItem;
						}).join('&');
					// If it's object then stringify it
					} else {
						return key + '=' + window.encodeURIComponent(JSON.stringify(value, (key, value) => {
							return typeof value === 'number' ? '' + value : value;
						}));
					}
				} else {
					return key + '=' + value;
				}
			}).join('&');
		}

		delete params.data;
	}

	return fetch(url, params).then(response => {
		const isError = response.status >= 400;

		if (isExternal) {
			if (isError) {
				throw new Error('Bad response from server');
			}

			return response;
		} else {
			return response.json().then(response => {
				if (isError) {
					throw new Error(response.error ? response.error : 'Bad response from server');
				}

				return response;
			});
		}
	});
}

export default function(url, params = {}, noUserSync) {
	return noUserSync ? request(url, params) : userSyncPromise().then(() => request(url, params));
}