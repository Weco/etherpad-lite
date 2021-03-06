import React, { Component } from 'react';
import { branch } from 'baobab-react/decorators';
import { Link } from 'react-router';
import { logout } from '../actions/user';

@branch({
	cursors: {
		user: ['currentUser'],
		userSync: ['userSync']
	},
	actions: {
		logout
	}
})
class Header extends Component {
	render() {
		const url = this.props.location.pathname + this.props.location.search;

		return (
			<header className='header'>
				<Link to='/' className='header__logo' />
				{this.props.userSync ? (
					!!this.props.user ? (
						<div className='header__links'>
							{this.props.user.role === 'admin' ? (
								<Link to='/admin' className='header__link'>
									admin panel
								</Link>
							) : ''}
							<Link to='/profile' className='header__link'>
								{this.props.user.name}
							</Link>
							<a className='header__link' onClick={this.props.actions.logout}>
								logout
							</a>
						</div>
					) : (
						<div className='header__links'>
							<Link
								className='header__link'
								to={{
									pathname: '/signin',
									state: {
										modal: true,
										returnTo: url,
										goTo: url
									}
								}}>
								Sign In
							</Link>
							<Link
								className='header__link'
								to={{
									pathname: '/signup',
									state: {
										modal: true,
										returnTo: url,
										goTo: url
									}
								}}>
								Sign Up
							</Link>
						</div>
					)
				) : ''}
			</header>
		);
	}
}

export default Header;