import React from 'react';
import classNames from 'classnames';
import { branch } from 'baobab-react/decorators';
import messages from '../../utils/messages';
import { formatPermissions, isOperationAllowed } from '../../utils/helpers';
import * as actions from '../../actions/pads';
import Base from '../Base.react';

@branch({
	cursors: {
		currentPad: ['currentPad'],
		currentUser: ['currentUser']
	},
	actions
})
export default class PadPrivacyModal extends Base {
	constructor(props) {
		super(props);

		this.state = {
			isActive: false,
			isSaving: false,
			permissions: {
				read: 'user',
				write: 'user'
			}
		};

		if (this.props.currentPad && this.props.currentPad.id) {
			this.updatePrivacyBtnState(this.props.currentPad);
		}

		this.cancelToggleModalSubscription = messages.subscribe('togglePrivacyModal', this.toggleModal.bind(this));
		this.cancelRequestStateSubscription = messages.subscribe('requestPrivacyBtnState', this.updatePrivacyBtnState.bind(this));
	}

	componentWillReceiveProps(nextProps) {
		if (this.props.currentPad !== nextProps.currentPad) {
			this.updatePrivacyBtnState(nextProps.currentPad);

			if (this.props.currentPad.id !== nextProps.currentPad.id) {
				this.setState({ isActive: false });
			}

			if (this.props.currentPad.permissions !== nextProps.currentPad.permissions) {
				this.updatePermissions(nextProps.currentPad.permissions);
			}
		}

		if (this.props.currentUser !== nextProps.currentUser) {
			this.updatePrivacyBtnState();
		}
	}

	componentWillUpdate(nextProps, nextState) {
		if (this.state.permissions !== nextState.permissions) {
			const permissions = nextState.permissions;
			const roles = ['user', 'authorizedUser', 'owner'];

			// Writters should always have read permissions
			if (roles.indexOf(permissions.write) < roles.indexOf(permissions.read)) {
				const role = nextState.permissions[this.state.permissions.read !== permissions.read ? 'read' : 'write'];

				this.setState({
					permissions: {
						read: role,
						write: role
					}
				});
			}
		}
	}

	updatePermissions(permissions) {
		const formattedPermissions = formatPermissions(permissions);
		const newPermissions = {
			read: formattedPermissions.read.length ? formattedPermissions.read[0] : 'owner',
			write: formattedPermissions.write.length ? formattedPermissions.write[0] : 'owner'
		};

		this.permissions = newPermissions;
		this.setState({
			permissions: newPermissions,
			isSaving: false
		});
	}

	updatePrivacyBtnState(pad = this.props.currentPad) {
		messages.send('togglePrivacyBtnState', {
			padId: pad.id,
			isActive: isOperationAllowed('manage', pad)
		});
	}

	toggleModal(state) {
		this.setState({
			isActive: typeof state === 'boolean' ? state : !this.state.isActive
		});
	}

	save(event) {
		event.preventDefault();

		if (this.state.permissions !== this.permissions && !this.state.isSaving) {
			const permissions = [];
			const padId = this.props.currentPad.id;
			const readRole = this.state.permissions.read;
			const writeRole = this.state.permissions.write;

			if (readRole !== 'owner') {
				permissions.push({
					operation: 'read',
					role: readRole
				});
			}

			if (writeRole !== 'owner') {
				readRole === writeRole && permissions.pop();

				permissions.push({
					operation: 'write',
					role: writeRole
				});
			}

			if (padId) {
				this.setState({ isSaving: true });
				this.props.actions.updatePermissions(padId, permissions);
			}
		}
	}

	render() {
		return (
			<div className={classNames('pad__modal pad__modal--privacy', { 'pad__modal--active': this.state.isActive })}>
				<div className='pad__modal__inner'>
					<div className='pad__modal__content'>
						<h1 className='pad__modal__title'>Pad privacy</h1>
						<form className='form form--privacy' onSubmit={this.save.bind(this)}>
							<div className='form__row'>
								<select valueLink={this.linkState('permissions.read')}>
									<option value='user'>Any user</option>
									<option value='authorizedUser'>Authorized user</option>
									<option value='owner'>Only owner</option>
								</select> can read this pad.
							</div>
							<div className='form__row'>
								<select valueLink={this.linkState('permissions.write')}>
									<option value='user'>Any user</option>
									<option value='authorizedUser'>Authorized user</option>
									<option value='owner'>Only owner</option>
								</select> can edit this pad.
							</div>
							<button type='submit' className='form__btn btn btn--small'>{this.state.isSaving ? 'Saving' : 'Save'}</button>
						</form>
					</div>
				</div>
			</div>
		);
	}

	componentWillUnmount() {
		this.cancelToggleModalSubscription && this.cancelToggleModalSubscription();
		this.cancelRequestStateSubscription && this.cancelRequestStateSubscription();
	}
}
