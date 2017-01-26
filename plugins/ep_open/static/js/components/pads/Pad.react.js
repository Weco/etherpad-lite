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
import PadEditsModal from './PadEditsModal.react';
import * as padsActions from '../../actions/pads';
import * as commonActions from '../../actions/common';

@branch({
	cursors: {
		currentPad: ['currentPad'],
		pads: ['pads'],
		padsHistory: ['padsHistory'],
		currentUser: ['currentUser'],
		token: ['token']
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
		const { isFullscreenActive, isHierarchyActive } = window.sessionStorage;

		this.state = {
			isFullscreenActive: isFullscreenActive === 'true',
			isHierarchyActive: !isHierarchyActive || isHierarchyActive === 'true',
			unsavedChanges: null
		};
		this.tabs = (props.location.query.tabs || currentTab).split(',');
		this.etherpads = {};
		this.activeEtherpads = [];
		this.subscriptions = [];

		this.state.isHierarchyActive && props.actions.addLayoutMode('pad_hierarchy');
		this.state.isFullscreenActive && props.actions.addLayoutMode('pad_fullscreen');
		this.tabs.length && props.actions.fetchPadsByIds(this.tabs);
		props.actions.setCurrentPad(currentTab);

		this.subscriptions.push(messages.subscribe('openPad', padId => {
			const currentTabIndex = this.tabs.indexOf(this.props.currentPad.id);

			if (this.tabs[currentTabIndex + 1] !== padId) {
				this.tabs = this.tabs.slice(0, currentTabIndex + 1);
				this.tabs.push(padId);
			}

			this.goToTab(padId);
		}));

		this.subscriptions.push(messages.subscribe('editorInit', data => {
			const { pad } = data;
			const padId = pad.getPadId();
			let etherpad = this.etherpads[padId] || {};

			this.etherpads[padId] = etherpad = Object.assign({}, etherpad, data, { isLoaded: true });

			if (padId === this.props.currentPad.id) {
				this.updataToolbarState();
				this.preloadChildrenEtherpads(etherpad);
			}

			pad.isOperationAllowed = isOperationAllowed;
			pad.collabClient.setOnUnsavedChanges(unsavedChanges => {
				this.etherpads[padId].unsavedChanges = unsavedChanges;
				this.props.currentPad.id === padId && this.setState({ unsavedChanges });
			});

			setTimeout(this.loadEtherpads.bind(this), 1000);
		}));

		this.subscriptions.push(messages.subscribe('requestRestoreBtnState', this.updateRestoreBtnState.bind(this)));

		this.updateEditbarOffset = this.updateEditbarOffset.bind(this);
		window.addEventListener('resize', this.updateEditbarOffset);
	}

	componentWillReceiveProps(nextProps) {
		if (nextProps.location.query.tabs !== this.props.location.query.tabs) {
			this.tabs = (nextProps.location.query.tabs || nextProps.params.padId || 'root').split(',');
			this.props.actions.fetchPadsByIds(this.tabs);
		}

		if (nextProps.params.padId !== this.props.params.padId) {
			const padId = nextProps.params.padId || 'root';

			if (!nextProps.location.query.tabs && !this.props.location.query.tabs) {
				this.tabs = [padId];
				this.props.actions.fetchPadsByIds(this.tabs);
			}

			this.props.actions.setCurrentPad(padId);
			// Clean pad offset until new pad data will be loaded and it will be updated with actual value
			this.updateCurrentPadOffset(0);
		}

		if (nextProps.currentPad !== this.props.currentPad) {
			this.setState({
				unsavedChanges: this.getCurrentEtherpad().unsavedChanges
			});
			this.updataToolbarState();
		}

		if (nextProps.currentUser !== this.props.currenUser) {
			this.updataToolbarState();
			this.updateRestoreBtnState();
		}

		if (nextProps.token !== this.props.token) {
			this.updateEtherpadToken();
		}

		if (nextProps.currentPad.edits !== this.props.currentPad.edits && this.state.unsavedChanges) {
			const { unsavedChanges } = this.state;
			let isChangesSaved = false;

			nextProps.currentPad.edits.some(edit => isChangesSaved = edit.changes.changeset === unsavedChanges.changeset);

			if (isChangesSaved) {
				const { editor } = this.getCurrentEtherpad();

				if (editor && editor.prepareUserChangeset().changeset) {
					try {
						editor.applyPreparedChangesetToBase();
						editor.revertChangesFromBase(unsavedChanges);
					} catch(e) {
						editor.callWithAce(ace => ace.frame.contentWindow.parent.location.reload());
					}

					this.setState({ unsavedChanges: null });
				}
			}
		}
	}

	getCurrentEtherpad() {
		return this.etherpads[this.props.currentPad.id] || {};
	}

	updataToolbarState() {
		const { toolbar } = this.getCurrentEtherpad();

		toolbar && toolbar[isOperationAllowed('write') ? 'enable' : 'disable']();
	}

	updateRestoreBtnState() {
		messages.send('toggleRestoreBtnState', {
			padId: this.props.currentPad.id,
			isActive: isOperationAllowed('write')
		});
	}

	updateEtherpadToken() {
		const { pad } = this.getCurrentEtherpad();

		pad && pad.updateToken();
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

			if (this.activeEtherpads) {
				this.activeEtherpads.reverse().some(etherpad => {
					const isMatch = etherpad.offset < clientX;

					this.goToTab(etherpad.id);

					return isMatch;
				});
			}
		}
	}

	updateCurrentPadOffset(offset) {
		if (this.props.currentPad && this.props.currentPad.id) {
			const iframe = document.getElementById(this.props.currentPad.id);

			if (iframe) {
				this.refs.content.style.left = iframe.style.left = offset + 'px';
				this.updateEditbarOffset();
			}
		}
	}

	updateEditbarOffset() {
		const iframe = document.getElementById(this.props.currentPad.id);
		const iframeEl = iframe && iframe.querySelector('.pad__iframe__el');
		const editbar = iframeEl && iframeEl.contentDocument.getElementById('editbar');

		if (this.refs.contentInner) {
			this.refs.contentInner.style.top = editbar ? (editbar.offsetHeight + 'px') : null;
		}
	}

	getOffsetFromEvent(event) {
		return Math.min(Math.max(0, this.currentPadX + event.clientX), this.maxPadOffset);
	}

	onDragStart(event, data) {
		this.currentPadX = parseInt(this.refs.content.style.left) - event.clientX;
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

	submitSuggestedEdits(event) {
		event.preventDefault();

		if (!this.props.currentUser) {
			const { location } = this.props;
			const url = location.pathname + location.search;

			return this.context.router.push({
				pathname: '/signin',
				state: {
					modal: true,
					returnTo: url,
					goTo: url
				}
			});
		}

		const padId = this.props.currentPad.id;
		const changes = this.getCurrentEtherpad().unsavedChanges;

		if (padId && changes) {
			this.props.actions.createSuggestedEdits(padId, {
				changes
			});
		}
	}

	createEtherpad(id, priority) {
		this.etherpad = {};

		let etherpad = this.etherpads[id];

		if (!etherpad) {
			const element = document.createElement('div');

			element.id = id;
			element.className = 'pad__iframe';
			element.innerHTML = `
				<div class="pad__iframe__screen"></div>
				<iframe class="pad__iframe__el" />
			`;
			this.refs.iframes.appendChild(element);

			this.etherpads[id] = etherpad = {
				id,
				element
			};
		}

		etherpad.priority = priority;

		return etherpad;
	}

	getEtherpadsList() {
		return Object.keys(this.etherpads).map(id => this.etherpads[id]);
	}

	loadEtherpads(startPriority = 1) {
		const etherpads = this.getEtherpadsList();
		let isPreviousLoaded = true;

		// Load iframes with etherpads in accordance with priorities, we have 4 priorities:
		// 1 - current pad
		// 2 - visible pads before current pad
		// 3 - children pads of current pad
		// 4 - currently unused pads
		for (let i = startPriority; i <= 4; i++) {
			const priorityEtherpads = etherpads.filter(etherpad => etherpad.priority === i);

			if (isPreviousLoaded) {
				priorityEtherpads.forEach(etherpad => {

					if (etherpad.element && !etherpad.isLoaded) {
						const iframeEl = etherpad.element.querySelector('.pad__iframe__el');

						if (!iframeEl.src) {
							iframeEl.src = `/p/${etherpad.id}?showControls=true&showChat=true&showLineNumbers=true&useMonospaceFont=false`;
						}

						isPreviousLoaded = false;
					}
				});
			} else {
				break;
			}
		}
	}

	preloadChildrenEtherpads(etherpad) {
		if (etherpad && etherpad.editor) {
			const frame = etherpad.editor.getFrame();
			const innerFrame = frame && frame.contentDocument.querySelector('[name=ace_inner]');
			const links = innerFrame && innerFrame.contentDocument.querySelectorAll('.link');

			if (links && links.length) {
				// Preload 5 first children pads
				Array.prototype.map.call(links, el => el.getAttribute('data-value'))
					.filter(id => id && !/^(f|ht)tps?:\/\//i.test(id))
					.slice(0, 5)
					.forEach(id => this.createEtherpad(id, 3));
				this.cleanExcessEtherpads();
			}
		}
	}

	cleanExcessEtherpads(id) {
		const etherpads = this.getEtherpadsList();

		// Clean etherpads with lower priority if amount of opened iframes with etherpads more than 20
		if (etherpads.length > 20) {
			etherpads
				.sort((a, b) => a.priority > b.priority)
				.slice(20)
				.forEach(etherpad => {
					if (etherpad && etherpad.priority > 2) {
						etherpad.element && etherpad.element.parentNode.removeChild(etherpad.element);
						delete this.etherpads[etherpad.id];
					}
				});
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
					{pad.type === 'root' ? 'Guy' : (
						isCurrent ? <EditableText text={pad.title} save={title => this.props.actions.updateCurrentPad({ title })} /> : pad.title
					)}
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
		const title = `${currentPad.title && currentPad.id !== 'root' ? (currentPad.title + ' | ') : ''}Guy`;
		const isReadOnlyChanges = isOperationAllowed('read') && !isOperationAllowed('write') && !!this.state.unsavedChanges;
		const isAuthorized = !!this.props.currentUser;

		return (
			<DocumentTitle title={title}>
				<div className='pad'>
					<div className='pad__tabs'>
						<div className='pad__tabs_scrollbox'>
							{this.buildTabs()}
						</div>
					</div>
					<div className='pad__iframes' ref='iframes' onClick={this.onIframeClick.bind(this)} />
					<div className='pad__content' ref='content'>
						<Draggable
							axis='none'
							onStart={this.onDragStart.bind(this)}
							onDrag={this.onDrag.bind(this)}
							onStop={this.onDragStop.bind(this)}>
							<div className={classNames('pad__resizer', { 'hidden': currentPad.type === 'root' })} ref='resizer' />
						</Draggable>
						<div className='pad__content__inner' ref='contentInner'>
							<PadLinkModal pad={currentPad} createPad={this.props.actions.createPad} />
							<PadPrivacyModal tabs={this.tabs} />
							<PadEditsModal getCurrentEtherpad={this.getCurrentEtherpad.bind(this)} />
							{isReadOnlyChanges ? (
								<div className='pad__message'>
									You do not have permissions to edit this pad, but you can {isAuthorized ? '' : 'login and '}<a href="" onClick={this.submitSuggestedEdits.bind(this)}>submit</a> your changes on moderation.
								</div>
							) : ''}
						</div>
					</div>
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
				</div>
			</DocumentTitle>
		);
	}

	componentDidUpdate() {
		const currentId = this.props.currentPad && this.props.currentPad.id;

		if (currentId) {
			const unloadedIframes = [];
			let padsOffsets = {};
			this.activeEtherpads = [];

			try {
				padsOffsets = JSON.parse(window.localStorage.padsOffsets);
			} catch (e) {}

			// Hide all etherpads and set the lowest priority
			Object.keys(this.etherpads).forEach(id => {
				const etherpad = this.etherpads[id];

				etherpad.element.className = 'pad__iframe';
				etherpad.priority = 4;
			});

			this.getPads().some((pad, index) => {
				if (!pad) return true;

				const isCurrent = pad.id === currentId;
				const etherpad = this.createEtherpad(pad.id, isCurrent ? 1 : 2);
				const offset = typeof padsOffsets[pad.id] === 'number' ? padsOffsets[pad.id] : 120 * index;

				etherpad.element.className = 'pad__iframe pad__iframe--active';
				etherpad.element.style.zIndex = index + 1;
				etherpad.element.style.left = offset + 'px';

				if (isCurrent) {
					this.refs.content.style.left = offset + 'px';
					this.updateEditbarOffset();
					etherpad.isLoaded && this.preloadChildrenEtherpads(etherpad);
				}

				this.activeEtherpads.push({
					id: pad.id,
					offset
				});

				return isCurrent;
			});

			this.cleanExcessEtherpads();
			this.loadEtherpads();
		}
	}

	componentWillUnmount() {
		this.subscriptions.forEach(subscription => subscription && subscription());
		messages.unsubscribe('.etherpad');
		this.props.actions.removeLayoutMode('pad_hierarchy');
		window.removeEventListener('resize', this.updateEditbarOffset);
	}
}