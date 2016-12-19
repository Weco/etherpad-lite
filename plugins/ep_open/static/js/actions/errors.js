export function addError(tree, message) {
	const id = new Date().getTime();

	tree.push('errors', { id, message });
	setTimeout(() => removeError(tree, id), 5000);
}

export function removeError(tree, id) {
	tree.set('errors', tree.select('errors').get().filter(error => error.id !== id));
}

export function errorHandler(tree) {
	return response => {
		(response.errors || [response.message || response.error]).forEach(error => error && addError(tree, error));
	};
}