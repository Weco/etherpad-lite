import React from 'react';
import classNames from 'classnames';
import Base from '../Base.react';

export default class EditableText extends Base {
	static propTypes = {
		text: React.PropTypes.string.isRequired,
		save: React.PropTypes.func.isRequired
	};

	constructor(props) {
		super();

		this.state = {
			text: props.text,
			isEditing: false
		};
	}

	componentWillReceiveProps(nextProps) {
		if (nextProps.text !== this.props.text) {
			this.setState({
				text: nextProps.text,
				isEditing: this.state.text === nextProps.text ? false : this.state.isEditing
			});
		}
	}

	onKeyDown(event) {
		let isEsc = event.which === 27;

		if (event.which === 13) {
			if (this.state.text === this.props.text) {
				isEsc = true;
			} else {
				this.props.save(this.state.text);
			}
		}

		if (isEsc) {
			this.setState({
				text: this.props.text,
				isEditing: false
			});
		}
	}

	onClick(event) {
		this.setState({ isEditing: true });
		event.stopPropagation();
	}

	render() {
		return (
			<div className={classNames('editable', {
					'editable--active': this.state.isEditing
				})}>
				{this.state.text}
				{this.state.isEditing ? (
					<input
						className='input'
						type='text'
						valueLink={this.linkState('text')}
						autoFocus={true}
						onKeyUp={this.onKeyDown.bind(this)}
						onClick={event => event.stopPropagation()} />
				) : ''}
				<i className='fa fa-pencil' onClick={this.onClick.bind(this)} />
			</div>
		);
	}
}