import React, { Component } from 'react';
import { Image, Dimensions, View, NativeAppEventEmitter } from 'react-native';
import { Loop, Stage } from 'react-game-kit/native';
import { connect } from 'react-redux';

import {HitBoxSprite} from './common';
import WellbeingBar from './WellbeingBar';
import CashInModal from './CashInModal';
import { sprites, staticImages, merchandise } from '@assets/images';
import { consumeItem, resetChangeStats, cashInSteps, updateStepCount } from '../actions';
import Health from '../services/health';

class Home extends Component {

  constructor(props){
    super(props);

    this.state = {
      animationState: spriteAnimations.IDLE,
      dragging: false,
      showModal: false
    };

    this.getAnimationState = this.getAnimationState.bind(this);
    this.touchStart = this.touchStart.bind(this);
    this.touchEnd = this.touchEnd.bind(this);
    this.renderBackpackItems = this.renderBackpackItems.bind(this);
    this.collidesWithMainSprite = this.collidesWithMainSprite.bind(this);
    this.cashInModal = this.cashInModal.bind(this);
    this.onDecline = this.onDecline.bind(this);
    this.onAccept = this.onAccept.bind(this);
  }

  componentWillMount(){
    this.subscription = NativeAppEventEmitter.addListener(
      'StepStats',
      (steps) => {
        if(steps.error){
          console.log('Error with native event listener :', steps.error);
        }else {
          console.log('StepStats handler',steps);
          this.props.updateStepCount(steps.value);
        }

      }
    );
    Health();
  }

  componentWillUnmount(){
    this.subscription.remove();
  }

  componentWillReceiveProps(nextProps){
      this.getAnimationState(nextProps.stats.health);
  }

  render() {
    const { width, height } = Dimensions.get('window');
    const { stats, steps } = this.props;
    const { mood, health, hunger, pawPoints} = stats;
    return (
      <View
        style={{flex: 1}}
      >
        <Loop style={styles.loopStyle}>
          <Stage style={styles.stageStyle} width={width} height={height}>
            <Image
              source={staticImages.petBackground}
              style={styles.bgStyle}
            >
              <HitBoxSprite
              ref="mainSprite"
              style = {styles.characterStyle}
              left = {width/2-105}
              top = {height/2-92}
              src = {sprites.petSprite}
              tileWidth = {210}
              tileHeight = {185}
              steps = {[9,9,7,9]}
              animationState={this.state.animationState}
              touchStart={this.touchStart}
              touchEnd={this.touchEnd}
              hitBox={{
                left:210/2-55,
                top:185/2-70,
                width: 95,
                height: 145
              }}
              />
              {this.renderBackpackItems()}
              <WellbeingBar
                style={styles.wellbeingBarStyle}
                stats={this.getStats()}
                cashInModal={this.cashInModal}
              />
              <CashInModal
                pawPoints={pawPoints}
                steps={steps}
                visible={this.state.showModal}
                onAccept={this.onAccept}
                onDecline={this.onDecline}
              />
            </Image>
          </Stage>
        </Loop>
      </View>
    );
  }

  getStats(){
    const displayStats = {};
    const { statsChanges, stats } = this.props;
    for(let i in statsChanges){
      displayStats[i] = (statsChanges[i] === 0) ? stats[i] : statsChanges[i]
    }
    return displayStats;
  }

  getAnimationState(health){
    if(this.state.dragging){
      return this.setState({animationState: spriteAnimations.WALK});
    } else if( health > 50){
      return this.setState({animationState: spriteAnimations.IDLE});
    } else {
      return this.setState({animationState: spriteAnimations.HURT});
    }
  }

  touchStart(){
    this.setState({
      dragging: true
    },() => this.getAnimationState(this.props.stats.health));

  }

  touchEnd(){
    this.checkCollision();
    this.setState({
      dragging: false
    },() => this.getAnimationState(this.props.stats.health));
  }

  checkCollision(item) {
    if(item){
      if(this.collidesWithMainSprite(item.id)){
        this.props.consumeItem(item);
        /*
          This resets the statsChanges object in the pet stat all at the same time.
          I have to do it here, because the update has to come from a centralized
          location in order to keep the individual PetStat components in sync.
          And since I don't have a handler on the animation completion from the
          PetStat component and anyway each one finishes at a different time, so
          I reasoned it was just better to reset the statsChanges property after
          a reasonable period of time when all of the animations should have finished.
          I am not concerned about millisecond accuracy for this.
        */
        setTimeout(() => {
          this.props.resetChangeStats({
            key: item.key,
            stats: {
              ...this.props.statsChanges
            }
          })
        }, 2200);
      }
    } else {
      const {backpack} = this.props;
      for(let key in backpack){
        const item = backpack[key];
        if(this.collidesWithMainSprite(item.id)){
          this.props.consumeItem(item);
          setTimeout(() => {
            this.props.resetChangeStats({
              key: item.key,
              stats: {
                ...this.props.statsChanges
              }
            })
          }, 2200);
        }
      }
    }
  }

  collidesWithMainSprite(id) {
    const { previousLeft:spriteLeft, previousTop:spriteTop } = this.refs["mainSprite"];
    const { previousLeft:itemLeft, previousTop:itemTop } = this.refs[id];
    const { left: hbLeft, top: hbTop, width: hbWidth, height: hbHeight} = this.refs["mainSprite"].props.hitBox;
    return (
      (itemTop >= spriteTop + hbTop) && (itemTop <= spriteTop + hbTop + hbHeight) &&
      (itemLeft >= spriteLeft + hbLeft) && (itemLeft <= spriteLeft + hbLeft + hbWidth)
    );
  }

  renderBackpackItems(){
    return this.props.backpack.map((item) => {
      return (
        <HitBoxSprite
        ref={item.id}
        key={item.id}
        style = {styles.backpackItemStyle}
        left = {item.location.left}
        top = {item.location.top}
        src = {merchandise[item.key]}
        steps = {[0]}
        touchEnd = {() => {this.checkCollision(item)}}
        />
      );
    });
  }

  cashInModal(){
    this.setState({showModal: true})
  }

  onDecline() {
    this.setState({ showModal: false });
  }

  onAccept() {
    this.onDecline();
    this.props.cashInSteps();
    setTimeout(() => {
      this.props.resetChangeStats({
        stats: {
          pawPoints: 0
        }
      })
    }, 2200);
  }

}

const spriteAnimations = {
  IDLE: 0,
  WALK: 1,
  JUMP: 2,
  HURT: 3
};

const styles = {
  loopStyle: {
    flex: 1
  },
  stageStyle: {
    flex: 1,
    position: 'relative'
  },
  bgStyle: {
    position: 'relative'
  },
  characterStyle: {
    width: 210,
    height: 185,
    position: 'relative'
  },
  backpackItemStyle: {
    position: 'absolute',
    width: 64,
    height: 64
  },
  wellbeingBarStyle: {
    height: 55 ,
    width: Dimensions.get('window').width,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    position: 'absolute',
    top: Dimensions.get('window').height - 55
  }
}

const mapStateToProps = (state) => {
  const arr = [];
  for( const key in state.backpack){
    const { items } = state.backpack[key];
    for( const index in items){
      if(items[index].left !== null){
        arr.push({ key, id: items[index].id, location: {left: items[index].left, top: items[index].top }})
      }
    }
  }

  return {...state.pet, backpack: arr}
}

export default connect(mapStateToProps,{ consumeItem, resetChangeStats, cashInSteps, updateStepCount })(Home);
