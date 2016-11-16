import window, { document } from 'global';
import React from 'react';
import ReactDOM from 'react-dom';
import classNames from 'classnames';
import { branch } from 'baobab-react/decorators';
import Draggable from 'react-draggable';
import Base from '../Base.react';
import Spinner from '../common/Spinner.react';
import EditableText from '../common/EditableText.react';
import * as actions from '../../actions/pads';

@branch({
	cursors: {
		currentPad: ['currentPad'],
		padsHierarchy: ['padsHierarchy']
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

		try {
			if (window.sessionStorage.expandedNodes) {
				expandedNodes = JSON.parse(window.sessionStorage.expandedNodes);
			}
		} catch(e) {}

		this.state = {
			isLoading: false,
			isResizing: false,
			expandedNodes: expandedNodes
		};
		this.width = window.sessionStorage.hierarchyPanelWidth || 240;
		this.expandPathToCurrentPad(this.props.currentPad);

		if (props.isActive) {
			this.state.isActive = true;
			this.props.actions.fetchHierarchy();
			setTimeout(() => this.updateWidth(this.width));
		}
	}

	componentWillReceiveProps(nextProps) {
		if (nextProps.isActive !== this.props.isActive) {
			this.updateWidth(nextProps.isActive ? this.width : null);
		}

		if (nextProps.isActive && nextProps.isActive !== this.props.isActive && !this.props.padsHierarchy) {
			this.props.actions.fetchHierarchy();
			this.setState({ isLoading: true });
		}

		if (nextProps.padsHierarchy !== this.props.padsHierarchy) {
			this.setState({ isLoading: false });
			this.expandPathToCurrentPad(this.props.currentPad, nextProps.padsHierarchy);
		}

		if (nextProps.currentPad !== this.props.currentPad) {
			this.expandPathToCurrentPad(nextProps.currentPad);
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

	expandPathToCurrentPad(currentPad, hierarchy = this.props.padsHierarchy) {
		const currentId = currentPad && currentPad.id;

		if (hierarchy && currentId) {
			const expandedNodes = Object.assign({}, this.state.expandedNodes);
			const step = (nodes, path) => {
				nodes.forEach(node => {
					if (node.id === currentId) {
						path.forEach(node => expandedNodes[node] = true);
					} else if (node.children) {
						step(node.children, path.concat(node.id));
					}
				});
			};

			hierarchy.children && step(hierarchy.children, []);
			this.setExpandedNodes(expandedNodes);
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

	buildList(list, path) {
		return (
			<div className='pad__hierarchy__list'>
				{list.map(node => (
					<div
						key={path.concat(node.id).join('_')}
						className={classNames('pad__hierarchy__node', {
							'pad__hierarchy__node--root': path.length === 1,
							'pad__hierarchy__node--active': this.props.currentPad.id === node.id,
							'pad__hierarchy__node--expanded': this.state.expandedNodes[node.id],
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
								<EditableText text={node.title} save={title => this.props.actions.updatePad(node.id, { title })} />
							</div>
						)}
						{node.children ? this.buildList(node.children, path.concat(node.id)) : null}
					</div>
				))}
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
						{this.props.padsHierarchy ? this.buildList(this.props.padsHierarchy.children || [], ['root']) : null}
					</div>
				</div>
			</div>
		);
	}

	componentWillUnmount() {
		this.updateWidth(null);
	}
}