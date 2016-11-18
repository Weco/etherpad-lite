import React from 'react';
import ReactDOM from 'react-dom';
import Select from 'react-select';
import { branch } from 'baobab-react/decorators';
import request from '../../utils/request';
import Base from '../Base.react';
import * as actions from '../../actions/pads';

@branch({
	actions
})
export default class PadsSearchBox extends Base {
	static propTypes = {
		onChange: React.PropTypes.func.isRequired,
		onFilterChange: React.PropTypes.func,
		filter: React.PropTypes.func,
		isActive: React.PropTypes.bool
	};

	constructor(props) {
		super(props);

		this.state = {
			isLoading: false,
			selectedPad: null
		};
		this.loadPads = query => {
			return request('/pads', {
				data: { query }
			}).then(data => ({
				options: data.rows.map(pad => ({
					value: pad.id,
					label: pad.title || pad.id
				}))
			}));
		};

		this.filterValue = '';
	}

	componentWillReceiveProps(nextProps) {
		if (nextProps.isActive !== this.props.isActive) {
			setTimeout(() => {
				const selectEl = ReactDOM.findDOMNode(this.refs.select);
				const selectFilterEl = selectEl.querySelector('input');

				if (selectFilterEl) {
					const inputEvent = document.createEvent('Event');
					const blurEvent = document.createEvent('Event');

					inputEvent.initEvent('input', true, true);
					blurEvent.initEvent('blur', true, true);

					selectFilterEl.value = ' ';
					selectFilterEl.dispatchEvent(inputEvent);
					selectFilterEl.value = '';
					selectFilterEl.dispatchEvent(inputEvent);
					selectFilterEl.dispatchEvent(blurEvent);
				}

				this.padChange(null);
				this.filterChange('');
			});
		}
	}

	padChange(selectedPad) {
		this.setState({ selectedPad });
		this.props.onChange({
			id: selectedPad ? selectedPad.value : null,
			title: selectedPad ? selectedPad.label : null
		});
	}

	filterChange(filterValue) {
		if (filterValue !== this.filterValue && this.props.onFilterChange) {
			this.filterValue = filterValue;
			this.props.onFilterChange(this.filterValue);
		}
	}

	filterSelectOptions(options, filterValue) {
		let filteredOptions = options.filter(option => option.label.toLowerCase().search(filterValue.toLowerCase()) > -1);

		if (this.props.filter) {
			filteredOptions = this.props.filter(filteredOptions);
		}

		this.filterChange(filterValue);

		return filteredOptions;
	}

	render() {
		return (
			<Select.Async
				ref='select'
				name='pad-name'
				placeholder='Pad name'
				value={this.state.selectedPad}
				isLoading={this.state.isLoading}
				onChange={this.padChange.bind(this)}
				ignoreCase={false}
				onBlurResetsInput={false}
				searchPromptText={false}
				loadingPlaceholder=''
				filterOptions={this.filterSelectOptions.bind(this)}
				loadOptions={this.loadPads} />
		);
	}
}