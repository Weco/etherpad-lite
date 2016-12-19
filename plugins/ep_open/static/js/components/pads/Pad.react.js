import window from 'global';
import React from 'react';
import classNames from 'classnames';
import { branch } from 'baobab-react/decorators';
import DocumentTitle from 'react-document-title';
import Draggable from 'react-draggable';
import Reorder from 'react-reorder';
import messages from '../../utils/messages';
import { isOperationAllowed } from '../../utils/helpers';
import Base from '../Base.react';
import EditableText from '../common/EditableText.react';
import PadsHierarchy from './PadsHierarchy.react';
import PadLinkModal from './PadLinkModal.react';
import PadPrivacyModal from './PadPrivacyModal.react';
import * as padsActions from '../../actions/pads';
import * as commonActions from '../../actions/common';

@branch({
	cursors: {
		currentPad: ['currentPad'],
		pads: ['pads'],
		padsHistory: ['padsHistory']
	},
	actions: Object.assign({}, padsActions, commonActions)
})
export default class Pad extends Base {
	static contextTypes = {
		router: React.PropTypes.object.isRequired
	};

	constructor(props) {
		super(props);

		const currentTab = props.params.padId || 'root';

		this.state = {
			isFullscreenActive: window.sessionStorage.isFullscreenActive === 'true',
			isHierarchyActive: window.sessionStorage.isHierarchyActive === 'true'
		};
		this.tabs = (props.location.query.tabs || currentTab).split(',');

		this.state.isHierarchyActive && props.actions.addLayoutMode('pad_hierarchy');
		this.state.isFullscreenActive && props.actions.addLayoutMode('pad_fullscreen');
		props.actions.fetchPadsByIds(this.tabs);
		props.actions.setCurrentPad(currentTab);

		this.cancelOpenPadSubscription = messages.subscribe('openPad', padId => {
			const currentTabIndex = this.tabs.indexOf(this.props.currentPad.id);

			if (this.tabs[currentTabIndex + 1] !== padId) {
				this.tabs = this.tabs.slice(0, currentTabIndex + 1);
				this.tabs.push(padId);
			}

			this.goToTab(padId);
		});
	}

	componentWillReceiveProps(nextProps) {
		if (nextProps.location.query.tabs !== this.props.location.query.tabs) {
			this.tabs = (nextProps.location.query.tabs || nextProps.params.padId || 'root').split(',');
			this.props.actions.fetchPadsByIds(this.tabs);
		}

		if (nextProps.params.padId !== this.props.params.padId) {
			this.props.actions.setCurrentPad(nextProps.params.padId || 'root');
		}
	}

	goToTab(id) {
		const query = this.tabs.length > 1 ? `?tabs=${this.tabs.join(',')}` : '';

		this.context.router.push(`/pads/${id}${query}`);
	}

	toggleMode(paramName, modeName) {
		const newValue = !this.state[paramName];

		window.sessionStorage.setItem(paramName, newValue);
		this.setState({ [paramName]: newValue });
		this.props.actions[newValue ? 'addLayoutMode' : 'removeLayoutMode'](modeName);
	}

	onIframeClick(event) {
		if (event.target.className === 'pad__iframe__screen') {
			const currentTabIndex = this.tabs.indexOf(this.props.currentPad.id);
			const clientX = event.clientX - this.refs.iframes.getBoundingClientRect().left;

			if (this.currentIframes) {
				this.currentIframes.reverse().some(iframeItem => {
					const isMatch = iframeItem.offset < clientX;

					this.goToTab(iframeItem.pad.id);

					return isMatch;
				});
			}
		}
	}

	updateCurrentPadOffset(offset) {
		if (this.props.currentPad && this.props.currentPad.id) {
			const iframe = document.getElementById(this.props.currentPad.id);

			if (iframe) {
				this.refs.resizer.style.left = iframe.style.left = offset + 'px';
			}
		}
	}

	getOffsetFromEvent(event) {
		return Math.min(Math.max(0, this.currentPadX + event.clientX), this.maxPadOffset);
	}

	onDragStart(event, data) {
		this.currentPadX = parseInt(this.refs.resizer.style.left) - event.clientX;
		this.maxPadOffset = this.refs.iframes.offsetWidth - 100;
	}

	onDrag(event, data) {
		this.updateCurrentPadOffset(this.getOffsetFromEvent(event));
	}

	onDragStop(event, data) {
		const offset = this.getOffsetFromEvent(event);
		let padsOffsets = {};

		try {
			padsOffsets = JSON.parse(window.localStorage.padsOffsets);
		} catch (e) {}

		padsOffsets[this.props.currentPad.id] = offset;
		window.localStorage.setItem('padsOffsets', JSON.stringify(padsOffsets));

		this.updateCurrentPadOffset(offset);
	}

	getPads() {
		const padsObject = {};

		this.props.pads.forEach(pad => padsObject[pad.id] = pad);

		return this.tabs.map(tab => padsObject[tab]);
	}

	onTabClick(padId) {
		if (padId !== this.props.currentPad.id) {
			this.goToTab(padId);
		}
	}

	onHistoryTabClick(event, entry) {
		this.props.actions.removePadsHistoryEntry(entry.url);

		if (event.target.className !== 'fa fa-close') {
			this.props.actions.addPadsHistoryEntry({
				title: this.props.currentPad.title,
				url: `/pads/${this.props.currentPad.id}?tabs=${this.tabs.join(',')}`
			});
			this.context.router.push(entry.url);
		}
	}

	buildTabs() {
		const tabs = [this.getPads().map(pad => {
			if (!pad) {
				return null;
			}

			const isCurrent = pad.id === this.props.currentPad.id;

			return (
				<div
					key={pad.id}
					className={classNames('pad__tab pad__tab--link', {
						'pad__tab--active': isCurrent
					})}
					onClick={this.onTabClick.bind(this, pad.id)}>
					{isCurrent ? (
						<EditableText text={pad.title} save={title => this.props.actions.updateCurrentPad({ title })} />
					) : pad.title}
				</div>
			);
		})];

		if (this.props.padsHistory.length) {
			tabs.push(
				<div key='separator' className='pad__tab__separator' />,
				<Reorder
					key='reorder'
					itemKey='url'
					lock='vertical'
					holdTime='200'
					list={[].concat(this.props.padsHistory)}
					template={React.createClass({
						render: function() {
							return <span>{this.props.item.title}<i className='fa fa-close' /></span>;
						}
					})}
					callback={(e, m, p, n, reorderedArray) => this.props.actions.setPadHistory(reorderedArray)}
					itemClicked={this.onHistoryTabClick.bind(this)}
					listClass='pad__tabs__history'
					itemClass='pad__tab'
					disableReorder={false} />
			);
		}

		return tabs;
	}

	render() {
		const { currentPad } = this.props;
		const title = `${currentPad.title && currentPad.id !== 'root' ? (currentPad.title + ' | ') : ''}Open Companies`;
		const isReadOnly = isOperationAllowed('read') && !isOperationAllowed('write');

		return (
			<DocumentTitle title={title}>
				<div className='pad'>
					<div className='pad__tabs'>
						<div className='pad__tabs_scrollbox'>
							{this.buildTabs()}
						</div>
					</div>
					<div className='pad__iframes' ref='iframes' onClick={this.onIframeClick.bind(this)} />
					<Draggable
						axis='none'
						onStart={this.onDragStart.bind(this)}
						onDrag={this.onDrag.bind(this)}
						onStop={this.onDragStop.bind(this)}>
						<div className={classNames('pad__resizer', { 'hidden': currentPad.type === 'root' })} ref='resizer' />
					</Draggable>
					<PadLinkModal pad={currentPad} createPad={this.props.actions.createPad} />
					<PadPrivacyModal />
					<PadsHierarchy isActive={this.state.isHierarchyActive} currentPad={currentPad} tabs={this.tabs} />
					<div
						className='pad__hierarchy_toggler'
						onClick={this.toggleMode.bind(this, 'isHierarchyActive', 'pad_hierarchy')}>
						<i className='fa fa-sitemap' />
					</div>
					<div
						className='pad__fullscreen_toggler'
						onClick={this.toggleMode.bind(this, 'isFullscreenActive', 'pad_fullscreen')}>
						<i className='fa fa-arrows-alt' />
					</div>
					{isReadOnly ? <div className='pad__mode'>Read only</div> : ''}
				</div>
			</DocumentTitle>
		);
	}

	componentDidUpdate() {
		const currentId = this.props.currentPad && this.props.currentPad.id;

		if (currentId) {
			const unloadedIframes = [];
			let padsOffsets = {};
			this.currentIframes = [];

			try {
				padsOffsets = JSON.parse(window.localStorage.padsOffsets);
			} catch (e) {}

			Array.prototype.forEach.call(this.refs.iframes.querySelectorAll('.pad__iframe'), el => el.className = 'pad__iframe');

			this.getPads().some((pad, index) => {
				if (!pad) return true;

				const isCurrent = pad.id === currentId;
				let iframe = document.getElementById(pad.id);

				if (!iframe) {
					iframe = document.createElement('div');
					iframe.id = pad.id;
					iframe.className = 'pad__iframe';
					iframe.innerHTML = `
						<div class="pad__iframe__screen"></div>
						<iframe class="pad__iframe__el" />
					`;
					this.refs.iframes.appendChild(iframe);
				}

				const iframeEl = iframe.querySelector('.pad__iframe__el');

				if (!iframeEl.src) {
					const source = `/p/${pad.id}?showControls=true&showChat=true&showLineNumbers=true&useMonospaceFont=false`;

					if (isCurrent) {
						iframeEl.src = source;
						iframeEl.onload = function() {
							// Load background pads in 2 seconds after current iframe loading
							setTimeout(() => unloadedIframes.forEach(data => data.element.src = data.source), 2000);
						};
					} else {
						unloadedIframes.push({
							element: iframeEl,
							source
						});
					}
				}

				let offset = typeof padsOffsets[pad.id] === 'number' ? padsOffsets[pad.id] : 120 * index;

				iframe.className = 'pad__iframe pad__iframe--active';
				iframe.style.zIndex = index + 1;
				iframe.style.left = offset + 'px';

				if (isCurrent) {
					this.refs.resizer.style.left = offset + 'px';
				}

				this.currentIframes.push({
					pad,
					offset
				});

				return isCurrent;
			});
		}
	}

	componentWillUnmount() {
		this.cancelOpenPadSubscription && this.cancelOpenPadSubscription();
		this.props.actions.removeLayoutMode('pad_hierarchy');
	}
}