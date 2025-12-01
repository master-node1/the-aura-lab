import { Injectable } from '@nestjs/common';

import * as _ from 'lodash';

@Injectable()
export class TransformUtils {
  camelToSnake(obj: any) {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.camelToSnake(item));
    }

    const snakeObj = {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        snakeObj[snakeKey] = this.camelToSnake(obj[key]);
      }
    }

    return snakeObj;
  }

  snakeToCamel(obj) {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.snakeToCamel(item));
    }

    const camelObj = {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const camelKey = _.camelCase(key);
        camelObj[camelKey] = this.snakeToCamel(obj[key]);
      }
    }

    return camelObj;
  }
}
