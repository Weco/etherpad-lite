import window from 'global';
import React, { Component } from 'react';
import classNames from 'classnames';
import { branch } from 'baobab-react/decorators';
import { Link } from 'react-router';
import DocumentTitle from 'react-document-title';
import { niceDate } from '../../utils/helpers';
import messages from '../../utils/messages';
import Base from '../Base.react';
import PadsSearchBox from './PadsSearchBox.react';
import PadsHierarchy from './PadsHierarchy.react';
import * as padsActions from '../../actions/pads';
import * as commonActions from '../../actions/common';

@branch({
    cursors: {
        currentPad: ['currentPad'],
        pads: ['pads']
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
            isLinkModalActive: false,
            isFullscreenActive: window.sessionStorage.isFullscreenActive === 'true',
            isHierarchyActive: window.sessionStorage.isHierarchyActive === 'true'
        };
        this.tabs = (props.location.query.tabs || currentTab).split(',');

        this.state.isHierarchyActive && props.actions.addLayoutMode('pad_hierarchy');
        this.state.isFullscreenActive && props.actions.addLayoutMode('pad_fullscreen');
        props.actions.fetchPadsByIds(this.tabs);
		props.actions.setCurrentPad(currentTab);

        this.cancelModalLinkSubscription = messages.subscribe('toggleLinkModal', this.toggleLinkModal.bind(this));
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
            this.props.actions.setCurrentPad(nextProps.params.padId);
        }
    }

    goToTab(id) {
        const query = this.tabs.length > 1 ? `?tabs=${this.tabs.join(',')}` : '';

        this.context.router.push(`/pads/${id}${query}`);
        this.setState({ isLinkModalActive: false });
    }

    toggleMode(paramName, modeName) {
        const newValue = !this.state[paramName];

        window.sessionStorage.setItem(paramName, newValue);
        this.setState({ [paramName]: newValue });
        this.props.actions[newValue ? 'addLayoutMode' : 'removeLayoutMode'](modeName);
    }

    toggleLinkModal(state) {
        const nextState = typeof state === 'boolean' ? state : !this.state.isLinkModalActive;

        if (nextState === false) {
            this.searchBox && this.searchBox.setState({ selectedPad: null });
        }

        this.setState({
            isLinkModalActive: nextState
        });
    }

    insertLink() {
        if (this.padLinkId && this.props.currentPad) {
            messages.send('newPadLink', {
                id: this.padLinkId,
                etherpadId: this.props.currentPad.etherpadId,
                title: this.padLinkTitle
            });
            this.toggleLinkModal();
        }
    }

    onSearchBoxChange(pad) {
        this.padLinkId = pad.id;
        this.padLinkTitle = pad.title
    }

    onIframeClick(event) {
        if (event.target.className === 'pad__iframe__screen') {
            const currentTabIndex = this.tabs.indexOf(this.props.currentPad.id);

            if (currentTabIndex > 0) {
                this.goToTab(this.tabs[currentTabIndex - 1]);
            }
        }
    }

    getPads() {
        const padsObject = {};

        this.props.pads.forEach(pad => padsObject[pad.id] = pad);

        return this.tabs.map(tab => padsObject[tab]);
    }

    buildTabs() {
        return this.getPads().map(pad => (
            pad ? (
                <div
                    key={pad.id}
                    className={classNames('pad__tab', {
                        'pad__tab--active': pad.id === this.props.currentPad.id
                    })}
                    onClick={this.goToTab.bind(this, pad.id)}>{pad.title}</div>
            ) : null
        ));
    }

	render() {
        const { currentPad } = this.props;
        const title = `${currentPad.title && currentPad.id !== 'root' ? (currentPad.title + ' | ') : ''}Open Companies`;

		return (
            <DocumentTitle title={title}>
                <div className='pad'>
                    <div className='pad__tabs'>
                        <div className='pad__tabs_scrollbox'>
                            {this.buildTabs()}
                        </div>
                    </div>
                    <div className='pad__iframes' ref='iframes' onClick={this.onIframeClick.bind(this)}></div>
                    <div className={classNames('pad__modal pad__modal--link', { 'pad__modal--active': this.state.isLinkModalActive })}>
                        <div className='pad__modal__inner'>
                            <h1 className='pad__modal__title'>Add link to another pad</h1>
                            <button className='btn' onClick={this.insertLink.bind(this)}>Add</button>
                            <PadsSearchBox
                                ref='{searchBox => this.searchBox = searchBox}'
                                onChange={this.onSearchBoxChange.bind(this)}
                                filter={pads => pads.filter(pad => pad.value !== currentPad.id)} />
                        </div>
                    </div>
                    <PadsHierarchy isActive={this.state.isHierarchyActive} />
                    <div
                        className='pad__hierarchy_toggler'
                        onClick={this.toggleMode.bind(this, 'isHierarchyActive', 'pad_hierarchy')}>
                        <i className='fa fa-sitemap'></i>
                    </div>
                    <div
                        className='pad__fullscreen_toggler'
                        onClick={this.toggleMode.bind(this, 'isFullscreenActive', 'pad_fullscreen')}>
                        <i className='fa fa-arrows-alt'></i>
                    </div>
                </div>
            </DocumentTitle>
		);
	}

    componentDidUpdate() {
        const etherpadId = this.props.currentPad && this.props.currentPad.etherpadId;

        if (etherpadId) {
            Array.prototype.forEach.call(this.refs.iframes.querySelectorAll('.pad__iframe'), el => el.className = 'pad__iframe');

            this.getPads().some((pad, index) => {
                if (!pad) return true;

                let iframe = document.getElementById(pad.etherpadId);

                if (!iframe) {
                    iframe = document.createElement('div');
                    iframe.id = pad.etherpadId;
                    iframe.className = 'pad__iframe';
                    iframe.innerHTML = `
                        <div class="pad__iframe__screen"></div>
                        <iframe class="pad__iframe__el" src="/p/${pad.etherpadId}?showControls=true&showChat=true&showLineNumbers=true&useMonospaceFont=false" />
                    `;
                    this.refs.iframes.appendChild(iframe);
                }

                iframe.className = 'pad__iframe pad__iframe--active';
                iframe.style.zIndex = index + 1;
                iframe.style.left = 120 * index + 'px';

                return pad.etherpadId === etherpadId;
            });
        }
    }

    componentWillUnmount() {
        this.cancelModalLinkSubscription && this.cancelModalLinkSubscription();
        this.cancelOpenPadSubscription && this.cancelOpenPadSubscription();
        this.props.actions.removeLayoutMode('pad_hierarchy');
    }
}