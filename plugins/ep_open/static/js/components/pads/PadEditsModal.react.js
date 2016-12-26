import window from 'global';
import React from 'react';
import classNames from 'classnames';
import { branch } from 'baobab-react/decorators';
import messages from '../../utils/messages';
import { isOperationAllowed, niceDate, mergedChanges } from '../../utils/helpers';
import * as actions from '../../actions/pads';
import Base from '../Base.react';

@branch({
	cursors: {
		currentPad: ['currentPad'],
		currentUser: ['currentUser']
	},
	actions
})
export default class PadEditsModal extends Base {
	static propTypes = {
		getCurrentEtherpad: React.PropTypes.func.isRequired
	};

	constructor(props) {
		super(props);

		this.state = {
			isActive: false,
			isSaving: false,
			activeEditId: null,
			activeEditsChanges: null
		};

		if (this.props.currentPad && this.props.currentPad.id) {
			this.updateEditsBtnState(this.props.currentPad);
			this.props.actions.fetchCurrentPadEdits();
		}

		this.cancelToggleModalSubscription = messages.subscribe('toggleEditsModal', this.toggleModal.bind(this));
		this.cancelRequestStateSubscription = messages.subscribe('requestEditsBtnState', this.updateEditsBtnState.bind(this));
	}

	componentWillReceiveProps(nextProps) {
		if (this.props.currentPad !== nextProps.currentPad) {
			this.updateEditsBtnState(nextProps.currentPad);

			if (this.props.currentPad.id !== nextProps.currentPad.id) {
				this.setState({ isActive: false });
				this.props.actions.fetchCurrentPadEdits();
			}
		}
	}

	updateEditsBtnState(pad = this.props.currentPad) {
		messages.send('toggleEditsBtnState', {
			padId: pad.id,
			isActive: pad.edits && !!pad.edits.length
		});
	}

	toggleModal(state) {
		this.setState({
			isActive: typeof state === 'boolean' ? state : !this.state.isActive
		});
	}

	getEditorText() {
		const { editor } = this.props.getCurrentEtherpad();

		return editor ? editor.getBaseText() : '';
	}

	toggleEdit(edit) {
		const { activeEditId } = this.state;
		const { pad, editor } = this.props.getCurrentEtherpad();

		this.cleanActiveEdit();

		if (activeEditId === edit.id) {
			this.setState({
				activeEditId: null,
				activeEditChanges: null
			});
		} else {
			const changes = mergedChanges(edit.text, this.getEditorText(), edit.baseText, edit.changes.author);

			if (editor) {
				try {
					changes.author && pad.collabClient.addHistoricalAuthors({ [changes.author]: edit.author });
					editor.applyChangesToBase(changes.changeset, changes.author || '', changes.apool);
					editor.setEditable(false);
					editor.callWithAce(ace => {
						const sideDivInner = ace.frame.contentDocument.getElementById('sidedivinner');
						const aceInner = ace.frame.contentDocument.querySelector('iframe[name=ace_inner]');

						sideDivInner && sideDivInner.classList.add('authorColors');
						aceInner && aceInner.contentDocument.body.classList.add('focus');
						setTimeout(ace.ace_updateAuthorHighliting, 1000);
					});

					this.setState({
						activeEditId: edit.id,
						activeEditChanges: changes
					});
				} catch (e) {}
			}
		}
	}

	cleanActiveEdit() {
		const { activeEditChanges } = this.state;

		if (activeEditChanges) {
			const { editor } = this.props.getCurrentEtherpad();

			try {
				editor.revertChangesFromBase(activeEditChanges);
				editor.setEditable(true);
			} catch(e) {
				this.setState({ isActive: false });
				editor.callWithAce(ace => ace.frame.contentWindow.parent.location.reload());
			}

			this.setState({
				activeEditId: null,
				activeEditChanges: null
			});
		}
	}

	approveEdit(edit) {
		const { activeEditChanges } = this.state;

		this.cleanActiveEdit();
		this.props.actions.approveSuggestedEdits(
			this.props.currentPad.id,
			edit.id,
			activeEditChanges || mergedChanges(edit.text, this.getEditorText(), edit.baseText, edit.changes.author)
		);
	}

	rejectEdit(edit) {
		this.cleanActiveEdit();
		this.props.actions.rejectSuggestedEdits(this.props.currentPad.id, edit.id);
	}

	render() {
		const { currentPad } = this.props;
		const edits = currentPad && currentPad.edits;
		const canWrite = isOperationAllowed('write');

		return (
			<div className={classNames('pad__modal pad__modal--edits', { 'pad__modal--active': this.state.isActive })}>
				<div className='pad__modal__inner'>
					<div className='pad__modal__content'>
						<h1 className='pad__modal__title'>Suggested edits</h1>
						<div className='edits'>
							{edits && edits.length ? edits.map(edit => (
								<div className='edit' key={edit.id}>
									<span className='edit__author'>{edit.owner ? (edit.owner.name || edit.owner.nickname) : ''}</span>
									<span className='edit__data'>{niceDate(edit.createdAt, '')}</span>
									{edit.message ? <div className='edit__message'>{edit.message}</div> : ''}
									<div className='edit__btns'>
										<button className='btn btn--small' onClick={this.toggleEdit.bind(this, edit)}>
											{this.state.activeEditId === edit.id ? 'Hide' : 'Show'}
										</button>
										{canWrite ? <button className='btn btn--small btn--green' onClick={this.approveEdit.bind(this, edit)}>Approve</button> : ''}
										{canWrite ? <button className='btn btn--small btn--red' onClick={this.rejectEdit.bind(this, edit)}>Reject</button> : ''}
									</div>
								</div>
							)) : <div className='edits__messaage'>No edits</div>}
						</div>
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
