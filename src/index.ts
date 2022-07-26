import { inflate } from 'pako';

const ZIP1 = 31;
const ZIP2 = 139;
const NIFTI1Size = 348;
const NUMBER_LOCATION = 4;
const NIFTI_NUMBER = [0x6e, 0x2b, 0x31];

// const TYPE_NONE            = 0;
// const TYPE_BINARY          = 1;
const TYPE_UINT8 = 2;
const TYPE_INT16 = 4;
const TYPE_INT32 = 8;
const TYPE_FLOAT32 = 16;
// const TYPE_COMPLEX64      = 32;
const TYPE_FLOAT64 = 64;
// const TYPE_RGB24         = 128;
const TYPE_INT8 = 256;
const TYPE_UINT16 = 512;
const TYPE_UINT32 = 768;

type NIFTI1_HEADER = {
  /**
   *
   */
  dims: number[];
  /**
   *
   */
  t_length: number;
  /**
   *
   */
  stat_length: number;
  /**
   *
   */
  numBits: number;
  /**
   *
   */
  vox_offset: number;
  /**
   *
   */
  datatypeCode: number;
};
// NIFTI1 header;
const nifti1_header_default: NIFTI1_HEADER = {
  // order: [],
  // xspace: {},
  // yspace: {},
  // zspace: {},
  vox_offset: 352,
  t_length: 1,
  stat_length: 1,
  numBits: 8,
  dims: [],
  datatypeCode: TYPE_UINT8,
};

/**
 *
 */
export class NIFTI {
  private header: NIFTI1_HEADER;
  private imageData: ArrayBuffer;
  /**
   *
   */
  constructor() {
    this.header = nifti1_header_default;
    this.imageData = new ArrayBuffer(0);
  }

  isZip = (data: ArrayBuffer): boolean => {
    if (!data) throw 'no buffer data';
    const buf = new DataView(data);
    if (buf.getUint8(0) === ZIP1) return true;
    if (buf.getUint8(1) === ZIP2) return true;
    return false;
  };

  deZip = <T extends ArrayBuffer>(data: T): ArrayBuffer => inflate(data).buffer;

  isNIFTI1 = (data: ArrayBuffer): boolean => {
    if (data.byteLength < NIFTI1Size) return false;
    const buf = new DataView(data);
    if (!buf) return false;
    return !!(
      buf.getUint8(NUMBER_LOCATION) === NIFTI_NUMBER[0] &&
      buf.getUint8(NUMBER_LOCATION + 1) === NIFTI_NUMBER[1] &&
      buf.getUint8(NUMBER_LOCATION + 2) === NIFTI_NUMBER[2]
    );
  };

  parseHeader = (data: ArrayBuffer) => {
    const dView = new DataView(data, 0, 348);
    let littleEndian = true;
    const sizeof_hdr = dView.getUint32(0, true);
    if (sizeof_hdr === 0x0000015c) {
      littleEndian = true;
    } else if (sizeof_hdr === 0x5c010000) {
      littleEndian = false;
    } else {
      throw 'This does not look like a NIfTI-1 file.';
    }
    const n_dims = dView.getUint16(40, littleEndian);
    if (n_dims !== 3) throw `Cannot handle ${n_dims} dimensional images yet`;
    // 3个维度的长度
    for (let i = 0; i < 3; i++) {
      this.header.dims.push(dView.getUint16(42 + i * 2, littleEndian));
    }
    // 时间维度
    this.header.t_length = dView.getUint16(48, littleEndian);
    this.header.stat_length = dView.getUint16(50, littleEndian);
    this.header.datatypeCode = dView.getUint16(70, littleEndian);
    // 每一个体素坐标所占用的字节
    this.header.numBits = dView.getUint16(72, littleEndian);
    this.header.vox_offset = Math.max(dView.getFloat32(108, littleEndian), 352);
    // const dataType = dView.getUint16(70, littleEndian);
    // const bitpix = dView.getUint16(72, littleEndian);

    // const xstep = dView.getFloat32(80, littleEndian);
    // const ystep = dView.getFloat32(84, littleEndian);
    // const zstep = dView.getFloat32(88, littleEndian);
    // const tstep = dView.getFloat32(92, littleEndian);
    // const scl_slope = dView.getFloat32(112, littleEndian);
    // const scl_inter = dView.getFloat32(116, littleEndian);

    // const qform_code = dView.getUint16(252, littleEndian);
    // const sform_code = dView.getUint16(254, littleEndian);
  };

  pickImage = (data: ArrayBuffer): ArrayBuffer => {
    const imageOffset = this.header.vox_offset;
    const dims =
      this.header.dims[0] * this.header.dims[1] * this.header.dims[2];
    this.imageData = data.slice(
      imageOffset,
      imageOffset +
        dims *
          this.header.t_length *
          this.header.stat_length *
          (this.header.vox_offset / 8),
    );
    return this.imageData;
  };
}

// 获取渲染arraybuffer
const getTypeData = (
  datatypeCode: number,
  niftiImage: ArrayBuffer,
): RelativeIndexable<number> => {
  let typedData;
  if (datatypeCode === TYPE_UINT8) {
    typedData = new Uint8Array(niftiImage);
  } else if (datatypeCode === TYPE_INT16) {
    typedData = new Int16Array(niftiImage);
  } else if (datatypeCode === TYPE_INT32) {
    typedData = new Int32Array(niftiImage);
  } else if (datatypeCode === TYPE_FLOAT32) {
    typedData = new Float32Array(niftiImage);
  } else if (datatypeCode === TYPE_FLOAT64) {
    typedData = new Float64Array(niftiImage);
  } else if (datatypeCode === TYPE_INT8) {
    typedData = new Int8Array(niftiImage);
  } else if (datatypeCode === TYPE_UINT16) {
    typedData = new Uint16Array(niftiImage);
  } else if (datatypeCode === TYPE_UINT32) {
    typedData = new Uint32Array(niftiImage);
  } else {
    return new Uint8Array(niftiImage);
  }
  return typedData;
};
// 将arraybuffer转为N*N*N的数组
const transformToMatrix = (arr: any, header: any) => {
  const newArr: any[] = [];
  const x = header[0];
  const y = header[1];
  const z = header[2];
  let index = 0;
  for (let i = 0; i < z; i++) {
    newArr[i] = [];
    for (let j = 0; j < y; j++) {
      newArr[i][j] = [];
      for (let k = 0; k < x; k++) {
        newArr[i][j][k] = arr[index];
        index++;
      }
    }
  }
  return newArr;
};

// a：前 p：后
type Direction = 'h' | 'f' | 'a' | 'p' | 'l' | 'r';
type RenderOption = {
  /**
   *
   */
  data: ArrayBuffer;
  /**
   *
   */
  header: NIFTI1_HEADER;
  /**
   *
   */
  direction?: Direction[];
};
/**
 *
 */
export class FormatNIFTI {
  private option: RenderOption;
  private typeData: any;
  private matrix: any[];
  private forMatData: { [key in Direction]?: number[] };
  private directionData: DirectionData;
  /**
   *
   * @param option
   */
  constructor(option: RenderOption) {
    this.option = option;
    this.typeData = [];
    this.forMatData = {};
    this.setTypeData();
    this.matrix = transformToMatrix(this.typeData as unknown as any, this.option.header.dims)
    const dims = {
      x: option.header.dims[0],
      y: option.header.dims[1],
      z: option.header.dims[2],
    };
    this.directionData = new DirectionData(this.matrix,dims);
  }

  private setTypeData = () => {
    this.typeData = getTypeData(
      this.option.header.datatypeCode,
      this.option.data,
    );
  };

  private getDirectionData = (key: Direction, x: number, y: number, z: number) => {
    this.forMatData[key] = this.directionData[key]({ x, y,z });
  }

  render = (x: number,y: number,z: number) => {
    console.time('start');
    (this.option.direction || ['h','r','a']).forEach(key => this.getDirectionData(key,x,y,z));
    console.timeEnd('start');
  }
};

class DirectionData{
  private matrix: any[];
  private dims: { x: number; y: number; z: number };
  constructor(matrix: any[],dims: { x: number; y: number; z: number }){
    this.matrix = matrix;
    this.dims = dims;
  }
  // anterior 前
  a = (voxel: { x: number; y: number; z: number }) => {
    const { y } = voxel;
    const arr = [];
    for(let z = 0; z < this.dims.z; z++){
      for(let x = 0;x < this.dims.x; x++){
        arr.push(this.matrix[y][z][x]);
      }
    }
    return arr;
  }
  // posterior 后
  p = (voxel: { x: number; y: number; z: number }) => {
    const { y } = voxel;
    const arr = [];
    for(let z = this.dims.z - 1; z > -1; z--){
      for(let x = this.dims.x - 1;x > -1; x--){
        arr.push(this.matrix[y][z][x]);
      }
    }
    return arr;
  }
  // left
  l = (voxel: { x: number; y: number; z: number }) => {
    const { x } = voxel;
    const arr = [];
    for(let y = this.dims.y - 1; y > -1; y--){
      for(let z = 0;z < this.dims.z;z++){
        arr.push(this.matrix[y][z][x]);
      }
    }
    return arr;
  }
  // right
  r = (voxel: { x: number; y: number; z: number }) => {
    const { x } = voxel;
    const arr = [];
    for(let y = 0;y < this.dims.y;y++){
      for(let z = 0;z < this.dims.z;z++){
        arr.push(this.matrix[y][z][x]);
      }
    }
    return arr;
  }
  // foot
  f = (voxel: { x: number; y: number; z: number }) => {
    const { z } = voxel;
    const arr = [];
    for(let y = 0;y < this.dims.y;y++){
      for(let x = 0;x < this.dims.x;x++){
        arr.push(this.matrix[y][z][x]);
      }
    }
    return arr;
  }
  // head
  h = (voxel: { x: number; y: number; z: number }) => {
    const { z } = voxel;
    const arr = [];
    for(let y = this.dims.y - 1;y > -1; y--){
      for(let x = 0;x < this.dims.x;x++){
        arr.push(this.matrix[y][z][x]);
      }
    }
    return arr;
  }
}
