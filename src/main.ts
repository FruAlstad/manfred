import './style.css'
import { Game } from './game/Game'

const canvas = document.querySelector('#scene')
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Missing game canvas')
}

new Game(canvas)
