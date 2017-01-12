import window, { document } from 'global';
import React from 'react';
import ReactDOM from 'react-dom';
import classNames from 'classnames';
import { branch } from 'baobab-react/decorators';
import Draggable from 'react-draggable';
import { isEmpty } from 'lodash';
import Base from '../Base.react';
import Spinner from '../common/Spinner.react';
import EditableText from '../common/EditableText.react';
import * as actions from '../../actions/pads';

@branch({
	cursors: {
		currentPad: ['currentPad'],
		currentUser: ['currentUser'],
		padsHierarchy: ['padsHierarchy'],
		privatePadsHierarchy: ['privatePadsHierarchy']
	},
	actions
})
export default class PadsHierarchy extends Base {
	static contextTypes = {
		router: React.PropTypes.object.isRequired
	};
	static propTypes = {
		isActive: React.PropTypes.bool.isRequired,
		currentPad: React.PropTypes.object.isRequired,
		tabs: React.PropTypes.array.isRequired
	};

	constructor(props) {
		super(props);

		let expandedNodes = {};
		let inactiveExpandedNodes = {};

		try {
			if (window.sessionStorage.expandedNodes) {
				expandedNodes = JSON.parse(window.sessionStorage.expandedNodes);
			}

			if (window.sessionStorage.inactiveExpandedNodes) {
				inactiveExpandedNodes = JSON.parse(window.sessionStorage.inactiveExpandedNodes);
			}
		} catch(e) {}

		this.state = {
			isLoading: false,
			isResizing: false,
			expandedNodes,
			inactiveExpandedNodes,
			type: 'public'
		};
		this.width = window.sessionStorage.hierarchyPanelWidth || 240;

		if (props.isActive) {
			this.state.isActive = true;
			this.props.actions.fetchHierarchy();
			this.props.actions.fetchPrivateHierarchy();
			setTimeout(() => this.updateWidth(this.width));
		}
	}

	componentDidMount() {
		this.expandPathToCurrentPad(this.props.tabs);
	}

	componentWillReceiveProps(nextProps) {
		if (nextProps.isActive !== this.props.isActive) {
			this.updateWidth(nextProps.isActive ? this.width : null);
		}

		if (nextProps.isActive && nextProps.isActive !== this.props.isActive && !this.props.padsHierarchy) {
			this.props.actions.fetchHierarchy();
			this.props.actions.fetchPrivateHierarchy();
			this.setState({ isLoading: true });
		}

		if (nextProps.tabs !== this.props.tabs) {
			this.expandPathToCurrentPad(nextProps.tabs);
		}

		if (nextProps.currentUser !== this.props.currentUser) {
			this.props.actions.fetchPrivateHierarchy();
		}

		if (nextProps.padsHierarchy !== this.props.padsHierarchy) {
			this.setState({ isLoading: false });
			this.expandPathToCurrentPad(this.props.tabs, nextProps.padsHierarchy);
		}

		if (nextProps.privatePadsHierarchy !== this.props.privatePadsHierarchy) {
			if (isEmpty(nextProps.privatePadsHierarchy)) {
				this.setState({ type: 'public' });
			} else {
				this.expandPathToCurrentPad(this.props.tabs, undefined, nextProps.privatePadsHierarchy);
			}
		}
	}

	goToPad(path) {
		const tabs = path.length > 1 ? `?tabs=${path.join(',')}` : '';
		const url = `/pads/${path[path.length - 1]}${tabs}`;
		let isSameBranch = true;

		for (var i = 0; i < Math.min(path.length, this.props.tabs.length); i++) {
			if (path[i] !== this.props.tabs[i]) {
				isSameBranch = false;
				break;
			}
		}

		if (!isSameBranch) {
			this.props.actions.removePadsHistoryEntry(url);
			this.props.actions.addPadsHistoryEntry({
				title: this.props.currentPad.title,
				url: `/pads/${this.props.currentPad.id}?tabs=${this.props.tabs.join(',')}`
			});
		}

		this.context.router.push(url);
		this.setState({ isActive: false });
	}

	openLink(link) {
		window.open(link, '_blank');
	}

	expandPathToCurrentPad(tabs, hierarchy = this.props.padsHierarchy, privateHierarchy = this.props.privatePadsHierarchy) {
		if (tabs && (hierarchy || privateHierarchy)) {
			const expandedNodes = Object.assign({}, this.state.expandedNodes);
			const checkPath = (nodes, path) => {
				while (!isEmpty(nodes) && !isEmpty(path)) {
					const node = nodes.filter(node => node.id === path[0])[0];

					nodes = node && node.children ? node.children.active : [];

					if (node) {
						path = path.slice(1);
					}
				}

				return isEmpty(path);
			};
			const isPublicPath = hierarchy && checkPath([hierarchy], tabs);
			const isPrivatePath = privateHierarchy && checkPath(privateHierarchy, tabs);

			tabs.slice(0, tabs.length - 1).forEach(tabId => expandedNodes[tabId] = true);

			this.setExpandedNodes(expandedNodes);

			// Change active hierarchy type to the one where was found current pad
			if (isPublicPath !== isPrivatePath) {
				let type;

				if (isPublicPath && this.state.type === 'private') {
					type = 'public';
				}

				if (isPrivatePath && this.state.type === 'public') {
					type = 'private';
				}

				type && this.setState({ type });
			}
		}
	}

	toggleNode(nodeId) {
		this.setExpandedNodes(Object.assign({}, this.state.expandedNodes, {
			[nodeId]: !this.state.expandedNodes[nodeId]
		}));
	}

	setExpandedNodes(expandedNodes) {
		this.setState({ expandedNodes });
		window.sessionStorage.setItem('expandedNodes', JSON.stringify(expandedNodes));
	}

	toggleInactiveNodes(nodeId, event) {
		const currentState = this.state.inactiveExpandedNodes[nodeId];
		const inactiveExpandedNodes = Object.assign({}, this.state.inactiveExpandedNodes, {
			[nodeId]: !currentState
		});

		if (!currentState && !this.state.expandedNodes[nodeId]) {
			this.toggleNode(nodeId);
		}

		this.setState({ inactiveExpandedNodes });
		window.sessionStorage.setItem('inactiveExpandedNodes', JSON.stringify(inactiveExpandedNodes));

		event.stopPropagation();
	}

	updateWidth(value) {
		if (!this.contentElement) {
			this.contentElement = document.body.querySelector('.content');
			this.headerElement = document.body.querySelector('.header');
			this.element = ReactDOM.findDOMNode(this);
		}

		if (value !== null) {
			value += 'px';
		}

		this.contentElement.style.marginLeft = value;
		this.headerElement.style.marginLeft = value;
		this.element.style.width = value;
	}

	buildChildren(children, path, isRoot) {
		const parentId = path[path.length - 1];
		const isInactiveVisible = this.state.inactiveExpandedNodes[parentId];
		const list = [].concat(
			children.active || [],
			isInactiveVisible ? (children.inactive || []).map(child => (Object.assign({ isInactive: true }, child))) : []
		);

		return (
			<div className='pad__hierarchy__list'>
				{list.map(node => {
					const hasInactive = node.children && node.children.inactive && node.children.inactive.length;
					const isNodeInactiveVisible = this.state.inactiveExpandedNodes[node.id];
					const expandedState = this.state.expandedNodes[node.id];
					// Expand first 2 levels of hierarchy by default
					const isExpanded = expandedState === true || (path.length < 2 && typeof expandedState === 'undefined');

					return (<div
						key={path.concat(node.id).join('_')}
						className={classNames('pad__hierarchy__node', {
							'pad__hierarchy__node--root': isRoot,
							'pad__hierarchy__node--active': this.props.currentPad.id === node.id,
							'pad__hierarchy__node--inactive': node.isInactive,
							'pad__hierarchy__node--has_inactive': hasInactive,
							'pad__hierarchy__node--expanded': isExpanded,
							'pad__hierarchy__node--parent': node.children
						})}>
						{node.children ? (
							<div
								className='pad__hierarchy__node__toggler'
								onClick={this.toggleNode.bind(this, node.id)} />
						) : null}
						{node.type === 'external' ? (
							<div
								className='pad__hierarchy__node__title'
								onClick={this.openLink.bind(this, node.id)}>
								{node.title}
								<i className='fa fa-external-link' />
							</div>
						) : (
							<div
								className='pad__hierarchy__node__title'
								onClick={this.goToPad.bind(this, path.concat(node.id))}>
								{node.isInactive ? node.title : <EditableText text={node.title} save={title => this.props.actions.updatePad(node.id, { title })} /> }
								{hasInactive ? (
									<i
										className={classNames('fa', {
											'fa-eye': isNodeInactiveVisible,
											'fa-eye-slash': !isNodeInactiveVisible
										})}
										title='Toggle visibilty of deleted links'
										onClick={this.toggleInactiveNodes.bind(this, node.id)} />
								) : null}
							</div>
						)}
						{node.children ? this.buildChildren(node.children, path.concat(node.id)) : null}
					</div>)
				})}
			</div>
		)
	}

	getWidthFromEvent(event) {
		// 8px is width of resizer block
		return event.clientX + 8;
	}

	onDragStart() {
		this.setState({ isResizing: true });
	}

	onDrag(event) {
		this.updateWidth(this.getWidthFromEvent(event));
	}

	onDragStop(event) {
		const width = this.getWidthFromEvent(event);

		this.updateWidth(width);
		this.width = width;
		window.sessionStorage.setItem('hierarchyPanelWidth', width);
		this.setState({ isResizing: false });
	}

	render() {
		const hasPrivateHierarchy = !isEmpty(this.props.privatePadsHierarchy);

		return (
			<div className={classNames('pad__hierarchy', {
					'pad__hierarchy--loading' : this.state.isLoading,
					'pad__hierarchy--resizing' : this.state.isResizing
				})}>
				<Draggable
					axis='none'
					onStart={this.onDragStart.bind(this)}
					onDrag={this.onDrag.bind(this)}
					onStop={this.onDragStop.bind(this)}>
					<div className='pad__hierarchy__resizer' />
				</Draggable>
				<div className='pad__hierarchy__scrollbox'>
					<div className='pad__hierarchy__inner'>
						{/*
						<div className='pad__hierarchy__search'>
							<input className='input' />
						</div>
						*/}
						<Spinner className='pad__hierarchy__spinner' />
						<div className={classNames('pad__hierarchy__node pad__hierarchy__node--root pad__hierarchy__node--main', {
								'pad__hierarchy__node--active': this.props.currentPad.id === 'root'
							})}>
							<div className='pad__hierarchy__node__title' onClick={this.goToPad.bind(this, ['root'])}>
								<div className='pad__hierarchy__logo'></div>
							</div>
						</div>
						{hasPrivateHierarchy ? (
							<div className='radios'>
								<label className='radios__item'>
									<input className='radios__item__el' type='radio' name='type' value='public' checkedLink={this.linkRadioState('type', 'public')} />
									<div className='radios__item__btn'>Open</div>
								</label>
								<label className='radios__item'>
									<input className='radios__item__el' type='radio' name='type' value='private' checkedLink={this.linkRadioState('type', 'private')} />
									<div className='radios__item__btn'>Private</div>
								</label>
							</div>
						) : ''}
						<div className={classNames('pad__hierarchy__block', {
								'hidden': this.state.type !== 'public'
							})}>
							{this.props.padsHierarchy ? this.buildChildren(this.props.padsHierarchy.children || {}, ['root'], true) : null}
						</div>
						{hasPrivateHierarchy ? (
							<div className={classNames('pad__hierarchy__block', {
									'hidden': this.state.type !== 'private'
								})}>
								{this.buildChildren({ active: this.props.privatePadsHierarchy }, [], true)}
							</div>
						) : ''}
					</div>
				</div>
			</div>
		);
	}

	componentWillUnmount() {
		this.updateWidth(null);
	}
}