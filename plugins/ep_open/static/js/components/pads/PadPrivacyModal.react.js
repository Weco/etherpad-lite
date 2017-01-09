import React from 'react';
import classNames from 'classnames';
import { branch } from 'baobab-react/decorators';
import Select from 'react-select';
import request from '../../utils/request';
import messages from '../../utils/messages';
import { formatPermissions, isOperationAllowed, getUserIdFromRole } from '../../utils/helpers';
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
			type: 'public',
			permissions: {
				read: 'user',
				write: 'user'
			},
			authorizedUsers: []
		};

		if (this.props.currentPad && this.props.currentPad.id) {
			this.updatePrivacyBtnState(this.props.currentPad);
			this.props.actions.fetchPadsAuthorizedUsers();
		}

		this.cancelToggleModalSubscription = messages.subscribe('togglePrivacyModal', this.toggleModal.bind(this));
		this.cancelRequestStateSubscription = messages.subscribe('requestPrivacyBtnState', this.updatePrivacyBtnState.bind(this));
	}

	componentWillReceiveProps(nextProps) {
		if (this.props.currentPad !== nextProps.currentPad) {
			this.updatePrivacyBtnState(nextProps.currentPad);
			this.props.actions.fetchPadsAuthorizedUsers();

			if (this.props.currentPad.id !== nextProps.currentPad.id) {
				this.setState({ isActive: false });
			}

			if (this.props.currentPad.permissions !== nextProps.currentPad.permissions) {
				this.updatePermissions(nextProps.currentPad.permissions);
			}

			if (this.props.currentPad.authorizedUsers !== nextProps.currentPad.authorizedUsers) {
				this.setState({
					authorizedUsers: nextProps.currentPad.authorizedUsers || []
				});
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
		const readRole = formattedPermissions.read.filter(role => !getUserIdFromRole(role))[0];
		const writeRole = formattedPermissions.write.filter(role => !getUserIdFromRole(role))[0];
		const type = readRole || writeRole ? 'public' : 'private';
		const newPermissions = {
			read: readRole || 'user',
			write: writeRole || 'user'
		};

		this.permissions = newPermissions;
		this.setState({
			type,
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

	loadUsers(query) {
		return request('/users', {
			data: { query }
		}).then(data => ({
			options: data.rows.map(user => ({
				value: user.id,
				label: `${user.name} (${user.email})`,
				user
			}))
		}));
	}

	onUsersSelectChange(selected) {
		this.setState({
			authorizedUsers: this.state.authorizedUsers.concat([selected.user])
		});
	}

	filterUsersSelectOptions(options, filterValue) {
		const selectedUserIds = this.state.authorizedUsers.map(user => user.id);
		const ownerId = this.props.currentPad.owner ? this.props.currentPad.owner.id : this.props.currentPad.ownerId;

		return options.filter(option => {
			const userId = option.user.id;

			return (
				option.label.toLowerCase().search(filterValue.toLowerCase()) > -1 &&
				selectedUserIds.indexOf(userId) === -1 &&
				userId !== ownerId
			);
		});
	}

	deleteAuthorizedUsers(userId) {
		this.setState({
			authorizedUsers: this.state.authorizedUsers.filter(user => user.id !== userId)
		});
	}

	save(event) {
		event.preventDefault();

		if (this.state.isSaving) {
			return;
		}

		const permissions = [];
		const padId = this.props.currentPad.id;

		if (this.state.type === 'public' && this.state.permissions !== this.permissions) {
			const readRole = this.state.permissions.read;
			const writeRole = this.state.permissions.write;
			const { authorizedUsers } = this.props.currentPad;

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

			authorizedUsers && authorizedUsers.forEach(user => {
				permissions.push({
					operation: 'write',
					role: `user/${user.id}`
				});
			});
		} else if (this.state.type === 'private' && this.state.authorizedUsers !== this.props.currentPad.authorizedUsers) {
			this.state.authorizedUsers.forEach(user => {
				permissions.push({
					operation: 'write',
					role: `user/${user.id}`
				});
			});
		} else {
			return;
		}

		if (padId) {
			this.setState({ isSaving: true });
			this.props.actions.updatePermissions(padId, permissions);
		}
	}

	render() {
		return (
			<div className={classNames('pad__modal pad__modal--privacy', { 'pad__modal--active': this.state.isActive })}>
				<div className='pad__modal__inner'>
					<div className='pad__modal__content'>
						<h1 className='pad__modal__title'>Pad access</h1>
						<form className='form form--privacy' onSubmit={this.save.bind(this)}>
							<div className='form__row'>
								<div className='radios'>
									<label className='radios__item'>
										<input className='radios__item__el' type='radio' name='type' value='public' checkedLink={this.linkRadioState('type', 'public')} />
										<div className='radios__item__btn'>Public</div>
									</label>
									<label className='radios__item'>
										<input className='radios__item__el' type='radio' name='type' value='private' checkedLink={this.linkRadioState('type', 'private')} />
										<div className='radios__item__btn'>Private</div>
									</label>
								</div>
							</div>
							{this.state.type === 'public' ? (
								<div>
									<div className='form__row'>
										<select valueLink={this.linkState('permissions.read')}>
											<option value='user'>Any user</option>
											<option value='authorizedUser'>Authorized user</option>
										</select> can read this pad.
									</div>
									<div className='form__row'>
										<select valueLink={this.linkState('permissions.write')}>
											<option value='user'>Any user</option>
											<option value='authorizedUser'>Authorized user</option>
											<option value='owner'>Only owner</option>
										</select> can edit this pad.
									</div>
								</div>
							) : (
								<div className='form__row'>
									<Select.Async
										ref='select'
										placeholder='Users'
										value={false}
										isLoading={false}
										onChange={this.onUsersSelectChange.bind(this)}
										ignoreCase={false}
										onBlurResetsInput={false}
										searchPromptText={false}
										loadingPlaceholder=''
										cache={false}
										filterOptions={this.filterUsersSelectOptions.bind(this)}
										loadOptions={this.loadUsers} />
									<div className='user_list'>
										{this.state.authorizedUsers.map(user => (
											<div className='user_list__item' key={user.id}>
												{user.name} ({user.email})
												<i className='fa fa-close' onClick={this.deleteAuthorizedUsers.bind(this, user.id)}></i>
											</div>
										))}
									</div>
								</div>
							)}
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
