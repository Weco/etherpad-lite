import React from 'react';
import classNames from 'classnames';
import { branch } from 'baobab-react/decorators';
import messages from '../../utils/messages';
import Base from '../Base.react';
import Checkbox from '../common/Checkbox.react';
import PadsSearchBox from './PadsSearchBox.react';

@branch({
	cursors: {
		newPad: ['newPad']
	}
})
export default class PadLinkModal extends Base {
	static propTypes = {
		pad: React.PropTypes.object.isRequired,
		createPad: React.PropTypes.func.isRequired
	};

	constructor(props) {
		super(props);

		this.state = {
			isActive: false,
			isCompanyLink: false,
			externalLink: ''
		};

		this.linkId = null;
		this.linkTitle = null;

		this.cancelToggleModalSubscription = messages.subscribe('toggleLinkModal', this.toggleLinkModal.bind(this));
	}

	componentWillReceiveProps(nextProps) {
		if (nextProps.pad !== this.props.pad) {
			this.setState({ isActive: false });
		}

		if (
			nextProps.newPad &&
			(!this.props.newPad || this.props.newPad.id !== nextProps.newPad.id) &&
			nextProps.newPad.title === this.linkTitle
		) {
			this.linkId = nextProps.newPad.id;
			this.insertLink();
		}
	}

	toggleLinkModal(state) {
		const nextState = typeof state === 'boolean' ? state : !this.state.isActive;

		if (nextState === false) {
			this.searchBox && this.searchBox.setState({ selectedPad: null });
		}

		this.setState({
			isActive: nextState
		});
	}

	insertLink() {
		if (this.linkId && this.props.pad) {
			messages.send('newLink', {
				value: this.linkId,
				padId: this.props.pad.id,
				title: this.linkTitle
			});
			this.toggleLinkModal();
		} else if (this.linkTitle) {
			this.props.createPad({
				title: this.linkTitle,
				type: this.state.isCompanyLink ? 'company' : 'child'
			});
		}
	}

	onSearchBoxChange(pad) {
		this.linkId = pad.id;
		this.linkTitle = pad.title;
		this.setState({ isSelected: !!this.linkId });
	}

	onSearchBoxFilterChange(linkTitle) {
		if (!this.linkId) {
			this.linkTitle = linkTitle;
		}
	}

	insertExternalLink() {
		if (this.state.externalLink) {
			let url = this.state.externalLink;

			if (!/^(f|ht)tps?:\/\//i.test(url)) {
				url = "http://" + url;
			}

			messages.send('newLink', {
				value: url,
				padId: this.props.pad.id,
				title: this.state.externalLink
			});
			this.toggleLinkModal();
			this.setState({ externalLink: '' });
		}
	}

	render() {
		return (
			<div className={classNames('pad__modal pad__modal--link', { 'pad__modal--active': this.state.isActive })}>
				<div className='pad__modal__inner'>
					<div className='pad__modal__content'>
						<h1 className='pad__modal__title'>Add link to another pad</h1>
						<button className='btn' onClick={this.insertLink.bind(this)}>
							{this.state.isSelected ? 'Link to This' : 'Add'}
						</button>
						<PadsSearchBox
							ref='{searchBox => this.searchBox = searchBox}'
							onChange={this.onSearchBoxChange.bind(this)}
							onFilterChange={this.onSearchBoxFilterChange.bind(this)}
							isActive={this.state.isActive}
							filter={pads => pads.filter(pad => pad.value !== this.props.pad.id)} />
						<Checkbox
							label='Add as New Project'
							checkedLink={this.linkState('isCompanyLink')}
							disabled={this.state.isSelected} />
						<div className='pad__modal__separator'></div>
						<h1 className='pad__modal__title'>Add external link</h1>
						<input
							className='pad__just-link-input input'
							type="text"
							placeholder="http://example.com"
							valueLink={this.linkState('externalLink')} />
						<button className='btn' onClick={this.insertExternalLink.bind(this)}>Add</button>
					</div>
				</div>
			</div>
		);
	}

	componentWillUnmount() {
		this.cancelToggleModalSubscription && this.cancelToggleModalSubscription();
	}
}
