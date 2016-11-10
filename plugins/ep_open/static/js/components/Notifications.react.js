import React, { Component } from 'react';

export default class Notifications extends Component {
	static propTypes = {
		items: React.PropTypes.array.isRequired,
		close: React.PropTypes.func.isRequired
	}

	handleClick(id) {
		this.props.close(id);
	}

	render() {
		return (
			<div className='notifications'>
				<div className='notifications__viewport'>
					<div className='notifications__inner'>
						{this.props.items.map(item => {
							return (
								<div className='notifications__item' key={item.id} onClick={this.handleClick.bind(this, item.id)}>
									<div className='notifications__item-inner'>
										<div className='notifications__item-text'>{item.message}</div>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</div>
		);
	}
}